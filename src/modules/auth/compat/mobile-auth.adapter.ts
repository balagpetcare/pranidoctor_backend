import { z } from 'zod';

import { AuthAuditAction, UserRole } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { jsonOk } from '../../../legacy/web/lib/api-response.js';
import { authJsonError } from '../i18n/compat-error.js';
import { credentialMessageKey } from '../i18n/index.js';
import {
  issueCredentialsAfterOtpVerify,
  issueMobileCredentials,
  type MobileDeviceHints,
} from '../mobile-auth-credentials.service.js';
import {
  loginCustomerWithPassword,
  registerCustomerWithPassword,
  serializeAuthUser,
} from '../../../legacy/web/lib/mobile-auth/customer-credentials-service.js';
import { getMobileJwtSecret } from '../tokens/mobile-jwt.js';
import { OTP_MSG } from '../../../legacy/web/lib/mobile-auth/otp-messages.js';
import { getOtpConfig } from '../../../legacy/web/lib/mobile-auth/otp-env.js';
import { authRequestContext, recordAuthAuditFireAndForget } from '../auth-audit.service.js';
import { AUTH_CHANNELS } from '../identity-core.js';
import { getRefreshTokenService } from '../refresh-token.service.js';
import { getIdentityAuthService } from '../identity-auth.service.js';

const otpRequestSchema = z.object({ phone: z.string().min(8).max(32) }).strict();
const otpVerifySchema = z
  .object({
    phone: z.string().min(8).max(32),
    code: z.string().min(4).max(10),
    deviceKey: z.string().min(1).max(128).optional(),
    platform: z.string().max(32).optional(),
    pushToken: z.string().max(512).optional(),
    appVersion: z.string().max(32).optional(),
  })
  .strict();

function deviceHintsFromBody(
  body: { deviceKey?: string; platform?: string; pushToken?: string; appVersion?: string },
): MobileDeviceHints | undefined {
  if (!body.deviceKey?.trim()) return undefined;
  return {
    deviceKey: body.deviceKey,
    platform: body.platform,
    pushToken: body.pushToken,
    appVersion: body.appVersion,
  };
}

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
    name: z.string().min(1).max(120),
    mobile: z.string().min(8).max(32),
    email: z.union([z.string().email().max(200), z.literal('')]).optional(),
    password: z.string().min(6).max(200),
  })
  .strict();

const mobileRefreshSchema = z
  .object({
    refreshToken: z.string().min(1).max(512),
  })
  .strict();

export async function handleMobileOtpRequest(request: Request): Promise<Response> {
  if (!getMobileJwtSecret()) {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, {
      message: OTP_MSG.serverMisconfigured,
      forceLocale: 'bn-BD',
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON', forceLocale: 'bn-BD' });
  }

  const parsed = otpRequestSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
      forceLocale: 'bn-BD',
    });
  }

  const result = await getIdentityAuthService().mobileOtp.request(parsed.data.phone, request);
  if (!result.ok) {
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }

  return jsonOk({
    sent: true as const,
    otpTtlSeconds: getOtpConfig().ttlSeconds,
  });
}

export async function handleMobileOtpVerify(request: Request): Promise<Response> {
  if (!getMobileJwtSecret()) {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, {
      message: OTP_MSG.serverMisconfigured,
      forceLocale: 'bn-BD',
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON', forceLocale: 'bn-BD' });
  }

  const parsed = otpVerifySchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
      forceLocale: 'bn-BD',
    });
  }

  const verified = await getIdentityAuthService().mobileOtp.verify(
    parsed.data.phone,
    parsed.data.code,
    request,
  );
  if (!verified.ok) {
    return authJsonError(request, verified.code, verified.httpStatus, {
      message: verified.message,
      forceLocale: 'bn-BD',
    });
  }

  try {
    const issued = await issueCredentialsAfterOtpVerify(
      verified.userId,
      parsed.data.phone,
      verified.isNewUser,
      request,
      deviceHintsFromBody(parsed.data),
    );
    return jsonOk({
      accessToken: issued.tokens.accessToken,
      expiresInSeconds: issued.tokens.expiresIn,
      tokenType: 'Bearer' as const,
      ...(issued.tokens.refreshToken
        ? { refreshToken: issued.tokens.refreshToken }
        : {}),
      ...(issued.refreshExpiresInSeconds !== undefined
        ? { refreshExpiresInSeconds: issued.refreshExpiresInSeconds }
        : {}),
    });
  } catch {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, {
      message: OTP_MSG.tokenIssueFailed,
      forceLocale: 'bn-BD',
    });
  }
}

export async function handleMobileLogin(request: Request): Promise<Response> {
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

  const result = await loginCustomerWithPassword({
    rawIdentifier: parsed.data.identifier,
    password: parsed.data.password,
  });
  if (!result.ok) {
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGIN_FAILURE,
      channel: AUTH_CHANNELS.mobile,
      ...authRequestContext(request),
      metadata: { code: result.code },
    });
    const credKey = credentialMessageKey(result.code);
    return authJsonError(request, result.code, result.httpStatus, {
      messageKey: credKey ?? undefined,
      message: credKey ? undefined : result.message,
    });
  }

  const userRow = await getPrisma().user.findUnique({
    where: { id: result.userId },
    include: { customerProfile: true },
  });
  if (!userRow?.customerProfile) {
    return authJsonError(request, 'NOT_FOUND', 404, {
      messageKey: 'CUSTOMER_PROFILE_MISSING',
      forceLocale: 'bn-BD',
    });
  }

  recordAuthAuditFireAndForget({
    action: AuthAuditAction.LOGIN_SUCCESS,
    channel: AUTH_CHANNELS.mobile,
    userId: result.userId,
    role: UserRole.CUSTOMER,
    ...authRequestContext(request),
    metadata: { method: 'password' },
  });

  try {
    const creds = await issueMobileCredentials(
      result.userId,
      request,
      deviceHintsFromBody(parsed.data),
    );
    return jsonOk({
      accessToken: creds.accessToken,
      expiresInSeconds: creds.expiresInSeconds,
      tokenType: 'Bearer' as const,
      ...(creds.refreshToken !== undefined ? { refreshToken: creds.refreshToken } : {}),
      ...(creds.refreshExpiresInSeconds !== undefined
        ? { refreshExpiresInSeconds: creds.refreshExpiresInSeconds }
        : {}),
      user: serializeAuthUser({
        id: userRow.id,
        email: userRow.email,
        phone: userRow.phone,
        customerProfile: { displayName: userRow.customerProfile.displayName },
      }),
    });
  } catch {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'TOKEN_ISSUE_FAILED' });
  }
}

export async function handleMobileRefresh(request: Request): Promise<Response> {
  if (!getRefreshTokenService().isEnabled()) {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, { messageKey: 'REFRESH_NOT_ENABLED' });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }

  const parsed = mobileRefreshSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    });
  }

  const rotated = await getRefreshTokenService().rotate(
    parsed.data.refreshToken,
    authRequestContext(request),
  );
  if (!rotated) {
    return authJsonError(request, 'TOKEN_INVALID', 401, { messageKey: 'TOKEN_INVALID' });
  }

  return jsonOk({
    accessToken: rotated.accessToken,
    expiresInSeconds: rotated.expiresIn,
    tokenType: 'Bearer' as const,
    refreshToken: rotated.refreshToken,
    refreshExpiresInSeconds: rotated.refreshExpiresIn,
  });
}

export async function handleMobileRegister(request: Request): Promise<Response> {
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

  const emailRaw = parsed.data.email;
  const result = await registerCustomerWithPassword({
    name: parsed.data.name,
    rawMobile: parsed.data.mobile,
    rawEmail: emailRaw === '' ? undefined : emailRaw,
    password: parsed.data.password,
  });
  if (!result.ok) {
    const credKey = credentialMessageKey(result.code);
    return authJsonError(request, result.code, result.httpStatus, {
      messageKey: credKey ?? undefined,
      message: credKey ? undefined : result.message,
    });
  }

  const userRow = await getPrisma().user.findUnique({
    where: { id: result.userId },
    include: { customerProfile: true },
  });
  if (!userRow?.customerProfile) {
    return authJsonError(request, 'NOT_FOUND', 404, {
      messageKey: 'CUSTOMER_PROFILE_MISSING',
    });
  }

  try {
    const creds = await issueMobileCredentials(result.userId, request);
    return jsonOk({
      accessToken: creds.accessToken,
      expiresInSeconds: creds.expiresInSeconds,
      tokenType: 'Bearer' as const,
      ...(creds.refreshToken !== undefined ? { refreshToken: creds.refreshToken } : {}),
      ...(creds.refreshExpiresInSeconds !== undefined
        ? { refreshExpiresInSeconds: creds.refreshExpiresInSeconds }
        : {}),
      user: serializeAuthUser({
        id: userRow.id,
        email: userRow.email,
        phone: userRow.phone,
        customerProfile: { displayName: userRow.customerProfile.displayName },
      }),
    });
  } catch {
    return authJsonError(request, 'SERVER_MISCONFIGURED', 500, {
      messageKey: 'TOKEN_ISSUE_FAILED',
    });
  }
}
