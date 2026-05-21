import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

import { CacheKeys, CacheTTL } from '../../infra/cache/cache.keys.js';
import { SessionStatus, UserStatus } from '../../generated/prisma/index.js';
import { getConfig } from '../../shared/config/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { activeOnly } from '../../shared/database/soft-delete.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import { getRedis } from '../../infra/redis/redis.client.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { mapSessionRecord, mapUserRecord, toPrismaAuthContext } from './auth.repository.mappers.js';
import type {
  AuthUserRecord,
  CreateAuthUserInput,
  CreatePersistedSessionInput,
  OtpChallenge,
  PersistedSessionRecord,
  RefreshTokenRecord,
  RotateRefreshTokenInput,
  SocialIdentityLookup,
  StoreRefreshTokenInput,
} from './auth.repository.types.js';

const OTP_SENDS_SUFFIX = 'otp:sends:';
const DEFAULT_USER_ROLE = 'USER';

function redisKey(suffix: string): string {
  const { redis } = getConfig();
  return `${redis.prefix}${suffix}`;
}

function parseOtpChallenge(raw: string): OtpChallenge {
  const parsed = JSON.parse(raw) as OtpChallenge;
  return {
    ...parsed,
    expiresAt: new Date(parsed.expiresAt),
    createdAt: new Date(parsed.createdAt),
  };
}

const userWithRoleInclude = {
  role: { select: { name: true } },
} as const;

export interface AuthRepositoryInterface extends ModuleService {
  // Users
  findUserByPhone(phone: string): Promise<AuthUserRecord | null>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  /** Reserved for social login — returns null until identity table exists */
  findUserBySocialIdentity(_lookup: SocialIdentityLookup): Promise<AuthUserRecord | null>;
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  touchLastLogin(userId: string): Promise<void>;

  // Sessions (PostgreSQL persistence)
  createSession(input: CreatePersistedSessionInput): Promise<PersistedSessionRecord>;
  findSessionById(sessionId: string): Promise<PersistedSessionRecord | null>;
  findSessionByDevice(userId: string, deviceId: string): Promise<PersistedSessionRecord | null>;
  updateSessionActivity(sessionId: string): Promise<void>;
  revokeSession(sessionId: string, reason?: string): Promise<boolean>;
  revokeAllSessionsForUser(userId: string, exceptSessionId?: string, reason?: string): Promise<number>;

  // Refresh tokens (PostgreSQL)
  storeRefreshToken(input: StoreRefreshTokenInput): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findActiveRefreshTokenForSession(
    userId: string,
    sessionId: string
  ): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRecord>;
  revokeRefreshTokensForSession(userId: string, sessionId: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;

  // OTP (Redis — ephemeral)
  createOtpChallenge(phone: string, codeHash: string, expiresAt: Date): Promise<OtpChallenge>;
  findOtpChallenge(phone: string): Promise<OtpChallenge | null>;
  incrementOtpAttempts(id: string, phone: string): Promise<void>;
  markOtpVerified(id: string, phone: string): Promise<void>;
  deleteOtpChallenge(phone: string): Promise<void>;
  countRecentOtpRequests(phone: string, since: Date): Promise<number>;
}

export class AuthRepository implements AuthRepositoryInterface {
  readonly name = 'AuthRepository';

  async findUserByPhone(phone: string): Promise<AuthUserRecord | null> {
    const record = await getPrisma().user.findFirst({
      where: { phone, ...activeOnly },
      include: userWithRoleInclude,
    });
    return record ? mapUserRecord(record) : null;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const record = await getPrisma().user.findFirst({
      where: { email: email.toLowerCase(), ...activeOnly },
      include: userWithRoleInclude,
    });
    return record ? mapUserRecord(record) : null;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const record = await getPrisma().user.findFirst({
      where: { id: userId, ...activeOnly },
      include: userWithRoleInclude,
    });
    return record ? mapUserRecord(record) : null;
  }

  async findUserBySocialIdentity(_lookup: SocialIdentityLookup): Promise<AuthUserRecord | null> {
    return null;
  }

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    if (!input.phone && !input.email) {
      throw new Error('createUser requires phone or email');
    }

    const roleName = input.role ?? DEFAULT_USER_ROLE;
    const role = await getPrisma().role.findFirst({
      where: { name: roleName, ...activeOnly },
    });

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    const status = (input.status ?? UserStatus.ACTIVE) as UserStatus;

    const record = await getPrisma().user.create({
      data: {
        ...omitUndefined({
          phone: input.phone,
          email: input.email?.toLowerCase(),
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          tenantId: input.tenantId,
        }),
        status,
        role: { connect: { id: role.id } },
      },
      include: userWithRoleInclude,
    });

    return mapUserRecord(record);
  }

  async touchLastLogin(userId: string): Promise<void> {
    await getPrisma().user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async createSession(input: CreatePersistedSessionInput): Promise<PersistedSessionRecord> {
    const record = await getPrisma().userSession.create({
      data: {
        id: input.id,
        context: toPrismaAuthContext(input.context),
        status: SessionStatus.ACTIVE,
        expiresAt: input.expiresAt,
        mfaVerified: input.mfaVerified ?? false,
        user: { connect: { id: input.userId } },
        ...omitUndefined({
          deviceId: input.deviceId,
          deviceType: input.deviceType,
          platform: input.platform,
          appVersion: input.appVersion,
          deviceName: input.deviceName,
          pushToken: input.pushToken,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          tenantId: input.tenantId,
          mfaMethod: input.mfaMethod,
        }),
      },
    });

    return mapSessionRecord(record);
  }

  async findSessionById(sessionId: string): Promise<PersistedSessionRecord | null> {
    const record = await getPrisma().userSession.findFirst({
      where: { id: sessionId, ...activeOnly },
    });
    return record ? mapSessionRecord(record) : null;
  }

  async findSessionByDevice(
    userId: string,
    deviceId: string
  ): Promise<PersistedSessionRecord | null> {
    const record = await getPrisma().userSession.findFirst({
      where: {
        userId,
        deviceId,
        status: SessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        ...activeOnly,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
    return record ? mapSessionRecord(record) : null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await getPrisma().userSession.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE, ...activeOnly },
      data: { lastActiveAt: new Date() },
    });
  }

  async revokeSession(sessionId: string, reason?: string): Promise<boolean> {
    const result = await getPrisma().userSession.updateMany({
      where: { id: sessionId, status: SessionStatus.ACTIVE, ...activeOnly },
      data: omitUndefined({
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason,
      }),
    });
    return result.count > 0;
  }

  async revokeAllSessionsForUser(
    userId: string,
    exceptSessionId?: string,
    reason?: string
  ): Promise<number> {
    const result = await getPrisma().userSession.updateMany({
      where: omitUndefined({
        userId,
        status: SessionStatus.ACTIVE,
        ...activeOnly,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      }),
      data: omitUndefined({
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason ?? 'All sessions revoked',
      }),
    });
    return result.count;
  }

  async storeRefreshToken(input: StoreRefreshTokenInput): Promise<RefreshTokenRecord> {
    const record = await getPrisma().refreshToken.create({
      data: {
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        user: { connect: { id: input.userId } },
        session: { connect: { id: input.sessionId } },
        ...omitUndefined({ deviceId: input.deviceId }),
      },
    });
    return mapRefreshTokenRecord(record);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const record = await getPrisma().refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });
    return record ? mapRefreshTokenRecord(record) : null;
  }

  async findActiveRefreshTokenForSession(
    userId: string,
    sessionId: string
  ): Promise<RefreshTokenRecord | null> {
    const record = await getPrisma().refreshToken.findFirst({
      where: {
        userId,
        sessionId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return record ? mapRefreshTokenRecord(record) : null;
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const prisma = getPrisma();

    return prisma.$transaction(async (tx) => {
      const old = await tx.refreshToken.findUnique({ where: { id: input.oldTokenId } });
      if (!old) {
        throw new Error('Refresh token not found for rotation');
      }

      const newToken = await tx.refreshToken.create({
        data: {
          tokenHash: input.newTokenHash,
          expiresAt: input.newExpiresAt,
          user: { connect: { id: old.userId } },
          session: { connect: { id: old.sessionId } },
          ...omitUndefined({
            deviceId: input.deviceId ?? old.deviceId ?? undefined,
          }),
        },
      });

      await tx.refreshToken.update({
        where: { id: input.oldTokenId },
        data: {
          revoked: true,
          revokedAt: new Date(),
          rotatedAt: new Date(),
          rotatedToId: newToken.id,
        },
      });

      return mapRefreshTokenRecord(newToken);
    });
  }

  async revokeRefreshTokensForSession(userId: string, sessionId: string): Promise<void> {
    await getPrisma().refreshToken.updateMany({
      where: { userId, sessionId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await getPrisma().refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async createOtpChallenge(
    phone: string,
    codeHash: string,
    expiresAt: Date
  ): Promise<OtpChallenge> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    );

    const challenge: OtpChallenge = {
      id: nanoid(16),
      phone,
      codeHash,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    };

    const pipeline = redis.pipeline();
    pipeline.setex(challengeKey, ttlSeconds, JSON.stringify(challenge));

    const sendsKey = redisKey(`${OTP_SENDS_SUFFIX}${phone}`);
    const now = Date.now();
    pipeline.zadd(sendsKey, now, `${challenge.id}:${now}`);
    pipeline.expire(sendsKey, CacheTTL.OTP_RATE_LIMIT);

    await pipeline.exec();

    return challenge;
  }

  async findOtpChallenge(phone: string): Promise<OtpChallenge | null> {
    const redis = getRedis();
    const raw = await redis.get(redisKey(CacheKeys.otpChallenge(phone)));
    if (!raw) return null;
    return parseOtpChallenge(raw);
  }

  async incrementOtpAttempts(id: string, phone: string): Promise<void> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const raw = await redis.get(challengeKey);
    if (!raw) return;

    const challenge = parseOtpChallenge(raw);
    if (challenge.id !== id) return;

    challenge.attempts += 1;
    const ttl = await redis.ttl(challengeKey);
    if (ttl > 0) {
      await redis.setex(challengeKey, ttl, JSON.stringify(challenge));
    }
  }

  async markOtpVerified(id: string, phone: string): Promise<void> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const raw = await redis.get(challengeKey);
    if (!raw) return;

    const challenge = parseOtpChallenge(raw);
    if (challenge.id !== id) return;

    challenge.verified = true;
    const ttl = await redis.ttl(challengeKey);
    if (ttl > 0) {
      await redis.setex(challengeKey, ttl, JSON.stringify(challenge));
    }
  }

  async deleteOtpChallenge(phone: string): Promise<void> {
    const redis = getRedis();
    await redis.del(redisKey(CacheKeys.otpChallenge(phone)));
  }

  async countRecentOtpRequests(phone: string, since: Date): Promise<number> {
    const redis = getRedis();
    const sendsKey = redisKey(`${OTP_SENDS_SUFFIX}${phone}`);
    const count = await redis.zcount(sendsKey, since.getTime(), '+inf');
    return count;
  }
}

function mapRefreshTokenRecord(record: {
  id: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  deviceId: string | null;
  expiresAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  rotatedToId: string | null;
}): RefreshTokenRecord {
  return {
    id: record.id,
    userId: record.userId,
    sessionId: record.sessionId,
    tokenHash: record.tokenHash,
    deviceId: record.deviceId,
    expiresAt: record.expiresAt,
    revoked: record.revoked,
    revokedAt: record.revokedAt,
    rotatedAt: record.rotatedAt,
    rotatedToId: record.rotatedToId,
  };
}

/** Shared helper for hashing refresh tokens at the service layer */
export function hashTokenValue(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
