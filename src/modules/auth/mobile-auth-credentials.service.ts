import { getPrisma } from '../../shared/database/prisma.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { authRequestContext } from './auth-audit.service.js';
import type { AuthTokens } from './auth.types.js';
import { getDeviceService } from './device.service.js';
import { AUTH_CHANNELS, normalizeBdMobilePhone } from './identity-core.js';
import { getRefreshTokenService } from './refresh-token.service.js';
import { isAuthRefreshEnabled } from './refresh-token.config.js';
import { getSessionService } from './session.service.js';
import {
  MOBILE_SESSION_MAX_AGE,
  signMobileCustomerToken,
} from './tokens/mobile-jwt.js';

export type MobileDeviceHints = {
  deviceKey?: string;
  platform?: string;
  pushToken?: string;
  appVersion?: string;
};

export type IssuedMobileCredentials = {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken?: string;
  refreshExpiresInSeconds?: number;
  sessionId: string;
};

export async function issueMobileCredentials(
  userId: string,
  request?: Request,
  device?: MobileDeviceHints,
): Promise<IssuedMobileCredentials> {
  const ctx = authRequestContext(request);
  let deviceId: string | undefined;

  if (device?.deviceKey?.trim()) {
    const registered = await getDeviceService().registerOrUpdate({
      userId,
      deviceKey: device.deviceKey.trim(),
      ...omitUndefined({
        platform: device.platform,
        pushToken: device.pushToken,
        appVersion: device.appVersion,
      }),
    });
    deviceId = registered.id;
  }

  const session = await getSessionService().create({
    userId,
    channel: AUTH_CHANNELS.mobile,
    ...omitUndefined({
      deviceId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
  });

  const refreshSvc = getRefreshTokenService();
  let refreshToken: string | undefined;
  let refreshExpiresInSeconds: number | undefined;

  if (isAuthRefreshEnabled()) {
    const issued = await refreshSvc.issue({
      userId,
      sessionId: session.id,
      channel: AUTH_CHANNELS.mobile,
      ...omitUndefined({ deviceId }),
    });
    if (issued) {
      refreshToken = issued.rawToken;
      refreshExpiresInSeconds = Math.max(
        0,
        Math.floor((issued.expiresAt.getTime() - Date.now()) / 1000),
      );
    }
  }

  const accessToken = await signMobileCustomerToken(userId, session.id);

  return {
    accessToken,
    expiresInSeconds: MOBILE_SESSION_MAX_AGE,
    sessionId: session.id,
    ...(refreshToken !== undefined ? { refreshToken } : {}),
    ...(refreshExpiresInSeconds !== undefined ? { refreshExpiresInSeconds } : {}),
  };
}

/** Panel sessions — returns session id for JWT `sid` (P1-08). */
export async function recordPanelSession(
  userId: string,
  channel: typeof AUTH_CHANNELS.adminPanel | typeof AUTH_CHANNELS.doctorPanel | typeof AUTH_CHANNELS.technicianPanel,
  request?: Request,
): Promise<string> {
  const ctx = authRequestContext(request);
  const session = await getSessionService().create({
    userId,
    channel,
    ...omitUndefined({
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    }),
  });
  return session.id;
}

/** Shared OTP-verify → session + tokens (foundation + compat delegation). */
export async function issueCredentialsAfterOtpVerify(
  userId: string,
  phone: string,
  isNewUser: boolean,
  request?: Request,
  device?: MobileDeviceHints,
): Promise<{
  tokens: AuthTokens;
  user: { id: string; phone: string; isNewUser: boolean };
  refreshExpiresInSeconds?: number;
}> {
  const creds = await issueMobileCredentials(userId, request, device);
  const normalized = normalizeBdMobilePhone(phone) ?? phone;
  const row = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });

  return {
    tokens: {
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken ?? '',
      expiresIn: creds.expiresInSeconds,
    },
    user: {
      id: userId,
      phone: row?.phone ?? normalized,
      isNewUser,
    },
    ...(creds.refreshExpiresInSeconds !== undefined
      ? { refreshExpiresInSeconds: creds.refreshExpiresInSeconds }
      : {}),
  };
}

export async function logoutAllForUser(userId: string, channel?: string): Promise<void> {
  await getSessionService().revokeAllForUser(userId, {
    reason: 'logout_all',
    channel: channel ?? AUTH_CHANNELS.mobile,
  });
  await getRefreshTokenService().revokeAllForUser(userId);
}
