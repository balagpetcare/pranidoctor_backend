import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

import { getConfig } from '../../config/index.js';
import { logDebug, logInfo, logWarn } from '../../logger/logger.js';
import { getRedis } from '../../../infra/redis/redis.client.js';
import { omitUndefined } from '../../types/object.utils.js';
import type { AuthContext, SessionData, RefreshTokenData, DeviceInfo } from '../types.js';

const SESSION_PREFIX = 'session:';
const USER_SESSIONS_PREFIX = 'user:sessions:';
const REFRESH_TOKEN_PREFIX = 'refresh:';
const DEVICE_SESSION_PREFIX = 'device:session:';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreateSessionOptions {
  userId: string;
  context: AuthContext;
  deviceId?: string;
  deviceInfo?: DeviceInfo;
  ip?: string;
  userAgent?: string;
  ttlSeconds?: number;
}

export async function createSession(options: CreateSessionOptions): Promise<SessionData> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const sessionId = nanoid(21);
  const now = new Date();
  const ttl = options.ttlSeconds ?? 30 * 24 * 60 * 60;
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const session: SessionData = {
    id: sessionId,
    userId: options.userId,
    context: options.context,
    createdAt: now,
    lastActiveAt: now,
    expiresAt,
    revoked: false,
    mfaVerified: false,
    ...omitUndefined({
      deviceId: options.deviceId,
      deviceInfo: options.deviceInfo,
      ip: options.ip,
      userAgent: options.userAgent,
    }),
  };

  const pipeline = redis.pipeline();

  pipeline.setex(
    `${prefix}${SESSION_PREFIX}${sessionId}`,
    ttl,
    JSON.stringify(session)
  );

  pipeline.sadd(`${prefix}${USER_SESSIONS_PREFIX}${options.userId}`, sessionId);

  if (options.deviceId) {
    pipeline.setex(
      `${prefix}${DEVICE_SESSION_PREFIX}${options.userId}:${options.deviceId}`,
      ttl,
      sessionId
    );
  }

  await pipeline.exec();

  logInfo('Session created', {
    sessionId,
    userId: options.userId,
    context: options.context,
    deviceId: options.deviceId,
  });

  return session;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const data = await redis.get(`${prefix}${SESSION_PREFIX}${sessionId}`);
  if (!data) return null;

  const session = JSON.parse(data) as SessionData;

  session.createdAt = new Date(session.createdAt);
  session.lastActiveAt = new Date(session.lastActiveAt);
  session.expiresAt = new Date(session.expiresAt);
  if (session.revokedAt) session.revokedAt = new Date(session.revokedAt);

  return session;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const session = await getSession(sessionId);
  if (!session || session.revoked) return;

  session.lastActiveAt = new Date();

  const ttl = await redis.ttl(`${prefix}${SESSION_PREFIX}${sessionId}`);
  if (ttl > 0) {
    await redis.setex(
      `${prefix}${SESSION_PREFIX}${sessionId}`,
      ttl,
      JSON.stringify(session)
    );
  }
}

export async function revokeSession(
  sessionId: string,
  reason?: string
): Promise<boolean> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const session = await getSession(sessionId);
  if (!session) return false;

  session.revoked = true;
  session.revokedAt = new Date();
  if (reason !== undefined) {
    session.revokedReason = reason;
  }

  const pipeline = redis.pipeline();

  pipeline.setex(
    `${prefix}${SESSION_PREFIX}${sessionId}`,
    60,
    JSON.stringify(session)
  );

  pipeline.srem(`${prefix}${USER_SESSIONS_PREFIX}${session.userId}`, sessionId);

  if (session.deviceId) {
    pipeline.del(`${prefix}${DEVICE_SESSION_PREFIX}${session.userId}:${session.deviceId}`);
  }

  const refreshKeys = await redis.keys(`${prefix}${REFRESH_TOKEN_PREFIX}*:${sessionId}`);
  for (const key of refreshKeys) {
    pipeline.del(key);
  }

  await pipeline.exec();

  logInfo('Session revoked', {
    sessionId,
    userId: session.userId,
    reason,
  });

  return true;
}

export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
  reason?: string
): Promise<number> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const sessionIds = await redis.smembers(`${prefix}${USER_SESSIONS_PREFIX}${userId}`);

  let revokedCount = 0;
  for (const sessionId of sessionIds) {
    if (sessionId === exceptSessionId) continue;

    const revoked = await revokeSession(sessionId, reason ?? 'All sessions revoked');
    if (revoked) revokedCount++;
  }

  logInfo('All user sessions revoked', {
    userId,
    revokedCount,
    exceptSessionId,
  });

  return revokedCount;
}

export async function getUserSessions(userId: string): Promise<SessionData[]> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const sessionIds = await redis.smembers(`${prefix}${USER_SESSIONS_PREFIX}${userId}`);

  const sessions: SessionData[] = [];
  for (const sessionId of sessionIds) {
    const session = await getSession(sessionId);
    if (session && !session.revoked) {
      sessions.push(session);
    }
  }

  return sessions.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

export async function getDeviceSession(userId: string, deviceId: string): Promise<SessionData | null> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const sessionId = await redis.get(`${prefix}${DEVICE_SESSION_PREFIX}${userId}:${deviceId}`);
  if (!sessionId) return null;

  return getSession(sessionId);
}

export interface StoreRefreshTokenOptions {
  userId: string;
  sessionId: string;
  token: string;
  deviceId?: string;
  ttlSeconds: number;
}

export async function storeRefreshToken(options: StoreRefreshTokenOptions): Promise<string> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const tokenId = nanoid(16);
  const tokenHash = hashToken(options.token);

  const data: RefreshTokenData = {
    id: tokenId,
    userId: options.userId,
    sessionId: options.sessionId,
    tokenHash,
    expiresAt: new Date(Date.now() + options.ttlSeconds * 1000),
    revoked: false,
    ...omitUndefined({ deviceId: options.deviceId }),
  };

  await redis.setex(
    `${prefix}${REFRESH_TOKEN_PREFIX}${options.userId}:${options.sessionId}`,
    options.ttlSeconds,
    JSON.stringify(data)
  );

  logDebug('Refresh token stored', {
    tokenId,
    userId: options.userId,
    sessionId: options.sessionId,
  });

  return tokenId;
}

export async function validateRefreshTokenStorage(
  userId: string,
  sessionId: string,
  token: string
): Promise<{ valid: boolean; tokenData?: RefreshTokenData }> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const data = await redis.get(`${prefix}${REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`);
  if (!data) {
    return { valid: false };
  }

  const tokenData = JSON.parse(data) as RefreshTokenData;
  tokenData.expiresAt = new Date(tokenData.expiresAt);

  if (tokenData.revoked) {
    logWarn('Attempted use of revoked refresh token', { userId, sessionId });
    return { valid: false };
  }

  const tokenHash = hashToken(token);
  if (tokenHash !== tokenData.tokenHash) {
    logWarn('Refresh token hash mismatch', { userId, sessionId });
    return { valid: false };
  }

  return { valid: true, tokenData };
}

export async function rotateRefreshToken(
  userId: string,
  sessionId: string,
  newToken: string,
  ttlSeconds: number
): Promise<string> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const oldData = await redis.get(`${prefix}${REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`);
  let deviceId: string | undefined;

  if (oldData) {
    const parsed = JSON.parse(oldData) as RefreshTokenData;
    deviceId = parsed.deviceId;
  }

  return storeRefreshToken(
    omitUndefined({
      userId,
      sessionId,
      token: newToken,
      deviceId,
      ttlSeconds,
    })
  );
}

export async function revokeRefreshToken(userId: string, sessionId: string): Promise<void> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  await redis.del(`${prefix}${REFRESH_TOKEN_PREFIX}${userId}:${sessionId}`);

  logDebug('Refresh token revoked', { userId, sessionId });
}

export async function setMfaVerified(sessionId: string, method: 'otp' | 'totp' | 'biometric'): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  session.mfaVerified = true;
  session.mfaMethod = method;

  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const ttl = await redis.ttl(`${prefix}${SESSION_PREFIX}${sessionId}`);
  if (ttl > 0) {
    await redis.setex(
      `${prefix}${SESSION_PREFIX}${sessionId}`,
      ttl,
      JSON.stringify(session)
    );
  }

  logInfo('MFA verified for session', { sessionId, method });
}
