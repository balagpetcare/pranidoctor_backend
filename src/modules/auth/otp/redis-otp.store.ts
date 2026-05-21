import { nanoid } from 'nanoid';

import { CacheKeys, CacheTTL } from '../../../infra/cache/cache.keys.js';
import { getRedis } from '../../../infra/redis/redis.client.js';
import { getConfig } from '../../../shared/config/index.js';
import type { OtpChallenge } from '../auth.types.js';
import type { OtpStore } from './otp-store.interface.js';

const OTP_SENDS_SUFFIX = 'otp:sends:';

function redisKey(suffix: string): string {
  const { redis } = getConfig();
  return `${redis.prefix}${suffix}`;
}

function parseChallenge(raw: string): OtpChallenge {
  const parsed = JSON.parse(raw) as OtpChallenge;
  return {
    ...parsed,
    expiresAt: new Date(parsed.expiresAt),
    createdAt: new Date(parsed.createdAt),
  };
}

/**
 * Redis-backed OTP store (use when OTP_STORAGE=redis and REDIS_ENABLED=true).
 * MobileOtpAuthService continues to use Prisma by default until explicitly switched.
 */
export class RedisOtpStore implements OtpStore {
  async createChallenge(phone: string, codeHash: string, expiresAt: Date): Promise<OtpChallenge> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

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

  async findChallenge(phone: string): Promise<OtpChallenge | null> {
    const redis = getRedis();
    const raw = await redis.get(redisKey(CacheKeys.otpChallenge(phone)));
    if (!raw) return null;
    return parseChallenge(raw);
  }

  async incrementAttempts(id: string, phone: string): Promise<void> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const raw = await redis.get(challengeKey);
    if (!raw) return;

    const challenge = parseChallenge(raw);
    if (challenge.id !== id) return;

    challenge.attempts += 1;
    const ttl = await redis.ttl(challengeKey);
    if (ttl > 0) {
      await redis.setex(challengeKey, ttl, JSON.stringify(challenge));
    }
  }

  async markVerified(id: string, phone: string): Promise<void> {
    const redis = getRedis();
    const challengeKey = redisKey(CacheKeys.otpChallenge(phone));
    const raw = await redis.get(challengeKey);
    if (!raw) return;

    const challenge = parseChallenge(raw);
    if (challenge.id !== id) return;

    challenge.verified = true;
    const ttl = await redis.ttl(challengeKey);
    if (ttl > 0) {
      await redis.setex(challengeKey, ttl, JSON.stringify(challenge));
    }
  }

  async deleteChallenge(phone: string): Promise<void> {
    const redis = getRedis();
    await redis.del(redisKey(CacheKeys.otpChallenge(phone)));
  }

  async countRecentSends(phone: string, since: Date): Promise<number> {
    const redis = getRedis();
    const sendsKey = redisKey(`${OTP_SENDS_SUFFIX}${phone}`);
    return redis.zcount(sendsKey, since.getTime(), '+inf');
  }
}
