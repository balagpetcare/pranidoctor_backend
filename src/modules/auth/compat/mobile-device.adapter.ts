import { z } from 'zod';

import { AuthAuditAction } from '../../../generated/prisma/index.js';
import { authJsonError, authJsonOk } from '../i18n/compat-error.js';
import { requireMobileCustomer } from '../../../legacy/web/lib/mobile-auth/guard.js';
import { authRequestContext, recordAuthAuditFireAndForget } from '../auth-audit.service.js';
import {
  attachDeviceToActiveRefreshTokens,
  bindDeviceToSession,
} from '../device-session.helper.js';
import { getDeviceService } from '../device.service.js';
import { AUTH_CHANNELS } from '../identity-core.js';

const ALLOWED_PLATFORMS = new Set(['android', 'ios', 'web']);

const registerDeviceSchema = z
  .object({
    deviceKey: z.string().trim().min(1).max(128),
    platform: z.string().trim().max(32).optional(),
    pushToken: z.string().trim().max(512).optional(),
    appVersion: z.string().trim().max(32).optional(),
  })
  .strict();

function validatePlatform(platform: string | undefined): string | undefined {
  if (!platform) return undefined;
  const normalized = platform.toLowerCase();
  if (!ALLOWED_PLATFORMS.has(normalized)) {
    return undefined;
  }
  return normalized;
}

function deviceIdFromPath(request: Request): string | null {
  const path = new URL(request.url).pathname;
  const match = path.match(/\/api\/mobile\/devices\/([^/]+)\/?$/);
  return match?.[1]?.trim() ?? null;
}

export async function handleMobileDeviceRegister(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, {
      messageKey: 'INVALID_JSON',
      profileLocale: auth.ctx.profileLocale,
    });
  }

  const parsed = registerDeviceSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'DEVICE_PAYLOAD_INVALID',
      details: parsed.error.flatten(),
      profileLocale: auth.ctx.profileLocale,
    });
  }

  const platform = validatePlatform(parsed.data.platform);
  if (parsed.data.platform && !platform) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'DEVICE_PLATFORM_INVALID',
      profileLocale: auth.ctx.profileLocale,
    });
  }

  const { id: deviceId, replaced } = await getDeviceService().registerOrUpdate({
    userId: auth.ctx.userId,
    deviceKey: parsed.data.deviceKey,
    platform,
    pushToken: parsed.data.pushToken,
    appVersion: parsed.data.appVersion,
  });

  const sessionId = auth.ctx.sessionId;
  await bindDeviceToSession(auth.ctx.userId, sessionId, deviceId);
  await attachDeviceToActiveRefreshTokens(auth.ctx.userId, sessionId, deviceId);

  recordAuthAuditFireAndForget({
    action: AuthAuditAction.DEVICE_REGISTERED,
    channel: AUTH_CHANNELS.mobile,
    userId: auth.ctx.userId,
    ...authRequestContext(request),
    metadata: { deviceId, replaced },
  });

  return authJsonOk(
    request,
    {
      deviceId,
      deviceKey: parsed.data.deviceKey,
      registered: true,
      ...(replaced ? { replaced: true } : {}),
    },
    undefined,
    { profileLocale: auth.ctx.profileLocale },
  );
}

export async function handleMobileDeviceList(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const devices = await getDeviceService().listActiveForUser(auth.ctx.userId);
  return authJsonOk(
    request,
    {
      devices: devices.map((d) => ({
        id: d.id,
        deviceKey: d.deviceKey,
        platform: d.platform,
        appVersion: d.appVersion,
        lastActiveAt: d.lastActiveAt.toISOString(),
        hasPushToken: d.hasPushToken,
      })),
    },
    undefined,
    { profileLocale: auth.ctx.profileLocale },
  );
}

export async function handleMobileDeviceRevoke(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const deviceId = deviceIdFromPath(request);
  if (!deviceId) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'DEVICE_ID_REQUIRED',
      profileLocale: auth.ctx.profileLocale,
    });
  }

  const result = await getDeviceService().revokeWithCascade(
    auth.ctx.userId,
    deviceId,
    request,
  );
  if (!result.revoked) {
    return authJsonError(request, 'NOT_FOUND', 404, {
      messageKey: 'DEVICE_NOT_FOUND',
      profileLocale: auth.ctx.profileLocale,
    });
  }

  return authJsonOk(
    request,
    {
      revoked: true,
      deviceId,
      sessionsRevoked: result.sessionsRevoked,
    },
    undefined,
    { profileLocale: auth.ctx.profileLocale },
  );
}
