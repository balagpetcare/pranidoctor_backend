import { describe, expect, it } from 'vitest';

import type { AppConfig } from './config.schema.js';
import {
  isRedisEnabled,
  isRedisRequired,
  isStorageRequired,
  isStrictStartupMode,
  shouldSkipStartupValidation,
} from './infra.flags.js';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'development',
    port: 3000,
    appName: 'test',
    appVersion: '1.0.0',
    cors: { origins: ['http://localhost:3001'] },
    log: { level: 'info', format: 'json' },
    redis: { enabled: true, url: 'redis://localhost:6379', prefix: 'pd:' },
    storage: { driver: 'disabled', bucket: '', region: 'us-east-1' },
    skipStartupValidation: false,
    ...overrides,
  } as AppConfig;
}

describe('infra.flags', () => {
  it('respects REDIS_ENABLED via config.redis.enabled', () => {
    expect(isRedisEnabled(baseConfig())).toBe(true);
    expect(isRedisEnabled(baseConfig({ redis: { enabled: false, url: '', prefix: 'pd:' } }))).toBe(
      false
    );
  });

  it('requires Redis in production when enabled', () => {
    expect(isRedisRequired(baseConfig({ nodeEnv: 'production' }))).toBe(true);
    expect(
      isRedisRequired(
        baseConfig({
          nodeEnv: 'production',
          redis: { enabled: false, url: '', prefix: 'pd:' },
        })
      )
    ).toBe(false);
  });

  it('requires storage in production when driver is not disabled', () => {
    expect(isStorageRequired(baseConfig({ nodeEnv: 'production' }))).toBe(false);
    expect(
      isStorageRequired(
        baseConfig({
          nodeEnv: 'production',
          storage: { driver: 's3', bucket: 'b', region: 'us-east-1', enabled: true },
        })
      )
    ).toBe(true);
  });

  it('does not require storage when STORAGE_ENABLED=false', () => {
    expect(
      isStorageRequired(
        baseConfig({
          nodeEnv: 'production',
          storage: { driver: 's3', bucket: 'b', region: 'us-east-1', enabled: false },
        })
      )
    ).toBe(false);
  });

  it('detects strict startup mode', () => {
    expect(isStrictStartupMode(baseConfig())).toBe(false);
    expect(isStrictStartupMode(baseConfig({ nodeEnv: 'staging' }))).toBe(true);
    expect(isStrictStartupMode(baseConfig({ nodeEnv: 'production' }))).toBe(true);
  });

  it('honors skipStartupValidation flag', () => {
    expect(shouldSkipStartupValidation(baseConfig())).toBe(false);
    expect(shouldSkipStartupValidation(baseConfig({ skipStartupValidation: true }))).toBe(true);
  });
});
