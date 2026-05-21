import { Redis } from 'ioredis';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { getLogger } from '../../shared/logger/logger.js';

let redisInstance: Redis | null = null;

export function isRedisInitialized(): boolean {
  return redisInstance !== null;
}

export interface RedisClientOptions {
  config: AppConfig;
}

export function createRedisClient(options: RedisClientOptions): Redis {
  const { config } = options;
  const logger = getLogger();

  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error({ msg: 'Redis connection failed after 10 retries' });
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  redis.on('connect', () => {
    logger.info({ msg: 'Redis connecting' });
  });

  redis.on('ready', () => {
    logger.info({ msg: 'Redis ready' });
  });

  redis.on('error', (error: Error) => {
    logger.error({ msg: 'Redis error', error: error.message });
  });

  redis.on('close', () => {
    logger.warn({ msg: 'Redis connection closed' });
  });

  redis.on('reconnecting', () => {
    logger.info({ msg: 'Redis reconnecting' });
  });

  redisInstance = redis;
  return redis;
}

export function getRedis(): Redis {
  if (!redisInstance) {
    throw new Error(
      'Redis client not initialized. Set REDIS_ENABLED=true and ensure Redis is reachable, or disable Redis-dependent features.'
    );
  }
  return redisInstance;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    const logger = getLogger();
    logger.info({ msg: 'Disconnecting Redis client' });
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
  }
}

export async function checkRedisConnection(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const redis = getRedis();
  const start = Date.now();

  try {
    const result = await redis.ping();
    return {
      healthy: result === 'PONG',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

export function prefixKey(config: AppConfig, key: string): string {
  return `${config.redis.prefix}${key}`;
}
