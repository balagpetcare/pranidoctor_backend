import { z } from 'zod';

import { jsonOk } from '../../../legacy/web/lib/api-response.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { PARTNER_ROLES } from '../../partner-auth/partner-roles.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';
import { isStrongEnoughPassword, MIN_PASSWORD_LENGTH } from '../../partner-auth/password-reset.service.js';
import { loginPartnerWithPassword } from '../../partner-auth/partner-login.service.js';
import { PRACTICE_TYPES } from '../../partner-auth/doctor-tracks.rules.js';
import { applyPetTrack } from '../../partner-auth/doctor-tracks.service.js';
import { applyForPartnerRole } from '../../partner-auth/partner-apply.service.js';
import { registerPartner } from '../../partner-auth/partner-register.service.js';
import { buildPartnerSummary } from '../../partner-auth/partner-summary.js';
import { AuthAuditAction } from '../../../generated/prisma/index.js';
import { authRequestContext, recordAuthAuditFireAndForget } from '../auth-audit.service.js';
import { authJsonError } from '../i18n/compat-error.js';
import { AUTH_CHANNELS } from '../identity-core.js';
import { issueMobileCredentials, type MobileDeviceHints } from '../mobile-auth-credentials.service.js';
import { getMobileJwtSecret } from '../tokens/mobile-jwt.js';

const loginSchema = z
  .object({
    identifier: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
    deviceKey: z.string().min(1).max(128).optional(),
    platform: z.string().max(32).optional(),
    pushToken: z.string().max(512).optional(),
    appVersion: z.string().max(32).optional(),
  })
  .strict();

const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mobile: z.string().min(8).max(32),
    email: z.string().trim().email().max(200),
    password: z.string().min(1).max(200),
    primaryRole: z.enum(PARTNER_ROLES).optional(),
    deviceKey: z.string().min(1).max(128).optional(),
    platform: z.string().max(32).optional(),
    pushToken: z.string().max(512).optional(),
    appVersion: z.string().max(32).optional(),
  })
  .strict();

function deviceHints(body: {
  deviceKey?: string | undefined;
  platform?: string | undefined;
  pushToken?: string | undefined;
  appVersion?: string | undefined;
}): MobileDeviceHints | undefined {
  if (!body.deviceKey?.trim()) return undefined;
  return {
    deviceKey: body.deviceKey,
    ...omitUndefined({
      platform: body.platform,
      pushToken: body.pushToken,
      appVersion: body.appVersion,
    }),
  };
}

/** POST /api/mobile/partner/register */
export async function handlePartnerRegister(request: Request): Promise<Response> {
  if (!getMobileJwtSecret()) {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'AUTH_NOT_CONFIGURED' });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }
  const parsed = registerSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }
  if (!isStrongEnoughPassword(parsed.data.password)) {
    return authJsonError(request, 'WEAK_PASSWORD', 422, {
      message: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে এবং অক্ষর ও সংখ্যা দুটোই থাকতে হবে।`,
      forceLocale: 'bn-BD',
    });
  }

  const result = await registerPartner({
    name: parsed.data.name,
    mobile: parsed.data.mobile,
    email: parsed.data.email,
    password: parsed.data.password,
    primaryRole: parsed.data.primaryRole,
  });
  if (!result.ok) {
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }

  try {
    const creds = await issueMobileCredentials(result.userId, request, deviceHints(parsed.data));
    const partner = await buildPartnerSummary(result.userId);
    return jsonOk({
      accessToken: creds.accessToken,
      expiresInSeconds: creds.expiresInSeconds,
      tokenType: 'Bearer' as const,
      ...(creds.refreshToken !== undefined ? { refreshToken: creds.refreshToken } : {}),
      ...(creds.refreshExpiresInSeconds !== undefined
        ? { refreshExpiresInSeconds: creds.refreshExpiresInSeconds }
        : {}),
      partner,
    });
  } catch {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'TOKEN_ISSUE_FAILED' });
  }
}

/** GET /api/mobile/partner/me */
export async function handlePartnerMe(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const partner = await buildPartnerSummary(auth.userId);
  if (!partner) return authJsonError(request, 'NOT_FOUND', 404, { messageKey: 'NOT_FOUND' });
  return jsonOk(partner);
}

/** POST /api/mobile/partner/login — email or phone + password. */
export async function handlePartnerLogin(request: Request): Promise<Response> {
  if (!getMobileJwtSecret()) {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'AUTH_NOT_CONFIGURED' });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }

  const result = await loginPartnerWithPassword({
    identifier: parsed.data.identifier,
    password: parsed.data.password,
  });
  if (!result.ok) {
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGIN_FAILURE,
      channel: AUTH_CHANNELS.mobile,
      ...authRequestContext(request),
      metadata: { code: result.code, app: 'partner' },
    });
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }

  recordAuthAuditFireAndForget({
    action: AuthAuditAction.LOGIN_SUCCESS,
    channel: AUTH_CHANNELS.mobile,
    userId: result.userId,
    role: result.role,
    ...authRequestContext(request),
    metadata: { method: 'password', app: 'partner' },
  });

  try {
    const creds = await issueMobileCredentials(result.userId, request, deviceHints(parsed.data));
    const partner = await buildPartnerSummary(result.userId);
    return jsonOk({
      accessToken: creds.accessToken,
      expiresInSeconds: creds.expiresInSeconds,
      tokenType: 'Bearer' as const,
      ...(creds.refreshToken !== undefined ? { refreshToken: creds.refreshToken } : {}),
      ...(creds.refreshExpiresInSeconds !== undefined
        ? { refreshExpiresInSeconds: creds.refreshExpiresInSeconds }
        : {}),
      partner,
    });
  } catch {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'TOKEN_ISSUE_FAILED' });
  }
}

const optionalYears = z.number().int().min(0).max(70).optional();
const optionalBio = z.string().trim().max(1000).optional();

const applySchema = z.discriminatedUnion('role', [
  z
    .object({
      role: z.literal('DOCTOR'),
      licenseNumber: z.string().trim().min(3).max(60),
      degree: z.string().trim().min(2).max(120),
      specialization: z.string().trim().max(120).optional(),
      experienceYears: optionalYears,
      bio: optionalBio,
      speciesFocus: z.array(z.enum(['cattle_goat', 'poultry_duck'])).min(1).max(2),
    })
    .strict(),
  z
    .object({
      role: z.literal('AI_TECHNICIAN'),
      trainingProvider: z.string().trim().min(2).max(160),
      certificateNumber: z.string().trim().min(2).max(80),
      experienceYears: optionalYears,
      bio: optionalBio,
    })
    .strict(),
  z
    .object({
      role: z.literal('HEALTH_WORKER'),
      certification: z.string().trim().min(2).max(160),
      experienceYears: optionalYears,
      bio: optionalBio,
    })
    .strict(),
]);

/** POST /api/mobile/partner/apply — apply for (or re-submit) a partner role. */
export async function handlePartnerApply(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }
  const parsed = applySchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }

  const result = await applyForPartnerRole(auth.userId, parsed.data);
  if (!result.ok) {
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }
  return jsonOk(result.summary);
}

const petSchema = z
  .object({
    practiceName: z.string().trim().min(2).max(160),
    practiceType: z.enum(PRACTICE_TYPES as unknown as [string, ...string[]]),
    practiceAddress: z.string().trim().min(5).max(300),
    practiceLicenseNo: z.string().trim().max(80).optional(),
    yearsPracticing: z.number().int().min(0).max(70).optional(),
    monthlyCases: z.number().int().min(0).max(100000).optional(),
  })
  .strict();

/** POST /api/mobile/partner/doctor/pet-track — apply for the pet practice track. */
export async function handlePetTrackApply(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }
  const parsed = petSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }
  const result = await applyPetTrack(auth.userId, parsed.data);
  if (!result.ok) {
    return authJsonError(request, 'PET_TRACK_BLOCKED', result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }
  const summary = await buildPartnerSummary(auth.userId);
  return jsonOk(summary);
}
