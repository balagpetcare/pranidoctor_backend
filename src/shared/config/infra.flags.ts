import type { AppConfig } from './config.schema.js';

export function shouldSkipStartupValidation(config: AppConfig): boolean {
  return config.skipStartupValidation;
}

export function isRedisEnabled(config: AppConfig): boolean {
  return config.redis.enabled;
}

/** Redis must pass health checks before boot (production default). */
export function isRedisRequired(config: AppConfig): boolean {
  if (!config.redis.enabled) return false;
  return config.nodeEnv === 'production' || config.nodeEnv === 'staging';
}

/** Object storage must pass health checks before boot (production default). */
export function isStorageRequired(config: AppConfig): boolean {
  if (config.storage.driver === 'disabled') return false;
  return config.nodeEnv === 'production' || config.nodeEnv === 'staging';
}

export function isStrictStartupMode(config: AppConfig): boolean {
  return config.nodeEnv === 'production' || config.nodeEnv === 'staging';
}
