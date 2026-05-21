import type { Request, Response, NextFunction } from 'express';

import { getConfig } from '../../config/index.js';
import { TooManyRequestsError } from '../../errors/http.errors.js';
import { getRedis } from '../../../infra/redis/redis.client.js';
import { logWarn, logDebug } from '../../logger/logger.js';
import { getRequestContext } from '../../context/request-context.js';

import { RateLimitPresets, type RateLimitConfig, type RateLimitPresetName } from './rate-limit.config.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const appConfig = getConfig();
  const redis = getRedis();
  const prefix = appConfig.redis.prefix;

  const fullKey = `${prefix}${config.keyPrefix}${key}`;
  const now = Date.now();
  const windowStart = now - config.duration * 1000;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(fullKey, 0, windowStart);
  pipeline.zadd(fullKey, now, `${now}:${Math.random()}`);
  pipeline.zcard(fullKey);
  pipeline.expire(fullKey, config.duration);

  const results = await pipeline.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;

  const remaining = Math.max(0, config.points - count);
  const resetAt = new Date(now + config.duration * 1000);

  if (count > config.points) {
    const retryAfter = config.blockDuration ?? config.duration;

    logWarn('Rate limit exceeded', {
      key,
      count,
      limit: config.points,
      retryAfter,
    });

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig
): Promise<{ count: number; remaining: number; resetAt: Date }> {
  const appConfig = getConfig();
  const redis = getRedis();
  const prefix = appConfig.redis.prefix;

  const fullKey = `${prefix}${config.keyPrefix}${key}`;
  const now = Date.now();
  const windowStart = now - config.duration * 1000;

  await redis.zremrangebyscore(fullKey, 0, windowStart);
  const count = await redis.zcard(fullKey);

  return {
    count,
    remaining: Math.max(0, config.points - count),
    resetAt: new Date(now + config.duration * 1000),
  };
}

export async function resetRateLimit(key: string, config: RateLimitConfig): Promise<void> {
  const appConfig = getConfig();
  const redis = getRedis();
  const prefix = appConfig.redis.prefix;

  const fullKey = `${prefix}${config.keyPrefix}${key}`;
  await redis.del(fullKey);

  logDebug('Rate limit reset', { key });
}

function getClientIdentifier(req: Request): string {
  const ctx = getRequestContext();
  
  if (ctx?.userId) {
    return `user:${ctx.userId}`;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0]?.trim() 
    : req.ip ?? req.socket.remoteAddress ?? 'unknown';

  return `ip:${ip}`;
}

export function createRateLimitMiddleware(
  preset: RateLimitPresetName | RateLimitConfig,
  keyGenerator?: (req: Request) => string
) {
  const config = typeof preset === 'string' ? RateLimitPresets[preset] : preset;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = keyGenerator ? keyGenerator(req) : getClientIdentifier(req);
      const result = await checkRateLimit(key, config);

      res.setHeader('X-RateLimit-Limit', config.points);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter ?? config.duration);
        
        throw new TooManyRequestsError(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests, please try again later',
          {
            retryAfter: result.retryAfter,
            resetAt: result.resetAt.toISOString(),
          }
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const rateLimitGlobal = createRateLimitMiddleware('GLOBAL');
export const rateLimitApi = createRateLimitMiddleware('API_STANDARD');
export const rateLimitStrict = createRateLimitMiddleware('API_STRICT');
export const rateLimitOtpRequest = createRateLimitMiddleware('AUTH_OTP_REQUEST');
export const rateLimitOtpVerify = createRateLimitMiddleware('AUTH_OTP_VERIFY');
export const rateLimitLogin = createRateLimitMiddleware('AUTH_LOGIN');
export const rateLimitAiChat = createRateLimitMiddleware('AI_CHAT');
export const rateLimitUpload = createRateLimitMiddleware('UPLOAD');
export const rateLimitSearch = createRateLimitMiddleware('SEARCH');
export const rateLimitExport = createRateLimitMiddleware('EXPORT');
