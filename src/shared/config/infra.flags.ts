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

/** True when MEDIA_STORAGE=s3 — storage must be reachable at boot. */
export function isMediaStorageRequired(): boolean {
  return (process.env['MEDIA_STORAGE'] ?? '').trim().toLowerCase() === 's3';
}

/** Object storage must pass health checks before boot (production or MEDIA_STORAGE=s3). */
export function isStorageRequired(config: AppConfig): boolean {
  if (!config.storage.enabled) return false;
  if (config.storage.driver === 'disabled') return false;
  if (isMediaStorageRequired()) return true;
  return config.nodeEnv === 'production' || config.nodeEnv === 'staging';
}

export function isStrictStartupMode(config: AppConfig): boolean {
  return config.nodeEnv === 'production' || config.nodeEnv === 'staging';
}
