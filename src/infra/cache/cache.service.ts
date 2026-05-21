import type { AppConfig } from '../../shared/config/config.schema.js';
import { logDebug, logError } from '../../shared/logger/logger.js';
import { getRedis } from '../redis/redis.client.js';

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  incr(key: string, ttl?: number): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: [string, T][], ttl?: number): Promise<void>;
}

const DEFAULT_TTL = 3600;

export function createCacheService(config: AppConfig): CacheService {
  const prefix = config.redis.prefix;

  function prefixKey(key: string): string {
    return `${prefix}cache:${key}`;
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const redis = getRedis();
        const data = await redis.get(prefixKey(key));

        if (!data) {
          logDebug('Cache miss', { key });
          return null;
        }

        logDebug('Cache hit', { key });
        return JSON.parse(data) as T;
      } catch (error) {
        logError('Cache get error', error, { key });
        return null;
      }
    },

    async set<T>(key: string, value: T, ttl = DEFAULT_TTL): Promise<void> {
      try {
        const redis = getRedis();
        const data = JSON.stringify(value);
        await redis.setex(prefixKey(key), ttl, data);
        logDebug('Cache set', { key, ttl });
      } catch (error) {
        logError('Cache set error', error, { key });
      }
    },

    async del(key: string): Promise<void> {
      try {
        const redis = getRedis();
        await redis.del(prefixKey(key));
        logDebug('Cache del', { key });
      } catch (error) {
        logError('Cache del error', error, { key });
      }
    },

    async delPattern(pattern: string): Promise<number> {
      try {
        const redis = getRedis();
        const fullPattern = prefixKey(pattern);
        const keys = await redis.keys(fullPattern);

        if (keys.length === 0) {
          return 0;
        }

        const deleted = await redis.del(...keys);
        logDebug('Cache del pattern', { pattern, deleted });
        return deleted;
      } catch (error) {
        logError('Cache del pattern error', error, { pattern });
        return 0;
      }
    },

    async exists(key: string): Promise<boolean> {
      try {
        const redis = getRedis();
        const result = await redis.exists(prefixKey(key));
        return result === 1;
      } catch (error) {
        logError('Cache exists error', error, { key });
        return false;
      }
    },

    async incr(key: string, ttl?: number): Promise<number> {
      try {
        const redis = getRedis();
        const prefixed = prefixKey(key);
        const value = await redis.incr(prefixed);

        if (ttl && value === 1) {
          await redis.expire(prefixed, ttl);
        }

        return value;
      } catch (error) {
        logError('Cache incr error', error, { key });
        return 0;
      }
    },

    async decr(key: string): Promise<number> {
      try {
        const redis = getRedis();
        return await redis.decr(prefixKey(key));
      } catch (error) {
        logError('Cache decr error', error, { key });
        return 0;
      }
    },

    async expire(key: string, ttl: number): Promise<void> {
      try {
        const redis = getRedis();
        await redis.expire(prefixKey(key), ttl);
      } catch (error) {
        logError('Cache expire error', error, { key });
      }
    },

    async ttl(key: string): Promise<number> {
      try {
        const redis = getRedis();
        return await redis.ttl(prefixKey(key));
      } catch (error) {
        logError('Cache ttl error', error, { key });
        return -2;
      }
    },

    async getOrSet<T>(key: string, factory: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
      const cached = await this.get<T>(key);

      if (cached !== null) {
        return cached;
      }

      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    },

    async mget<T>(keys: string[]): Promise<(T | null)[]> {
      try {
        const redis = getRedis();
        const prefixedKeys = keys.map(prefixKey);
        const results = await redis.mget(...prefixedKeys);

        return results.map((data: string | null) => {
          if (!data) return null;
          try {
            return JSON.parse(data) as T;
          } catch {
            return null;
          }
        });
      } catch (error) {
        logError('Cache mget error', error, { keys });
        return keys.map(() => null);
      }
    },

    async mset<T>(entries: [string, T][], ttl = DEFAULT_TTL): Promise<void> {
      try {
        const redis = getRedis();
        const pipeline = redis.pipeline();

        for (const [key, value] of entries) {
          const data = JSON.stringify(value);
          pipeline.setex(prefixKey(key), ttl, data);
        }

        await pipeline.exec();
        logDebug('Cache mset', { count: entries.length, ttl });
      } catch (error) {
        logError('Cache mset error', error, { count: entries.length });
      }
    },
  };
}

let cacheServiceInstance: CacheService | null = null;

export function initializeCacheService(config: AppConfig): CacheService {
  cacheServiceInstance = createCacheService(config);
  return cacheServiceInstance;
}

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    throw new Error('Cache service not initialized');
  }
  return cacheServiceInstance;
}
