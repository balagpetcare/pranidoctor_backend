import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppConfig } from '../../shared/config/config.schema.js';

vi.mock('../../infra/redis/redis.client.js', () => ({
  isRedisInitialized: vi.fn(),
  checkRedisConnection: vi.fn(),
  getRedis: vi.fn(),
  prefixKey: vi.fn((_config: AppConfig, key: string) => `pd:${key}`),
}));

vi.mock('../../shared/security/rate-limit/safe-rate-limit.js', () => ({
  isRateLimitingAvailable: vi.fn(),
}));

import {
  checkRedisConnection,
  getRedis,
  isRedisInitialized,
} from '../../infra/redis/redis.client.js';
import { isRateLimitingAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';
import { probeRedisHealth } from './redis.health.js';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'production',
    port: 3000,
    appName: 'test',
    appVersion: '1.0.0',
    skipStartupValidation: false,
    redis: { enabled: true, url: 'redis://localhost:6379', host: 'localhost', port: 6379, prefix: 'pd:' },
    ...overrides,
  } as AppConfig;
}

describe('probeRedisHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimitingAvailable).mockReturnValue(false);
  });

  it('reports disabled when REDIS_ENABLED=false', async () => {
    const result = await probeRedisHealth(
      baseConfig({ redis: { enabled: false, url: '', host: 'localhost', port: 6379, prefix: 'pd:' } }),
    );

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('disabled');
    expect(result.details.enabled).toBe(false);
    expect(result.details.features.usageCounters).toBe('postgres');
    expect(result.details.features.budgetTracking).toBe('postgres');
  });

  it('reports unhealthy when enabled but not initialized', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(false);

    const result = await probeRedisHealth(baseConfig());

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('not initialized');
    expect(result.details.initialized).toBe(false);
  });

  it('reports healthy on connected PING and write probe', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(isRateLimitingAvailable).mockReturnValue(true);
    vi.mocked(checkRedisConnection).mockResolvedValue({ healthy: true, latency: 2 });
    vi.mocked(getRedis).mockReturnValue({
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue('123'),
    } as never);

    const result = await probeRedisHealth(baseConfig());

    expect(result.healthy).toBe(true);
    expect(result.details.connected).toBe(true);
    expect(result.details.probeWriteOk).toBe(true);
    expect(result.details.rateLimitBackend).toBe('available');
    expect(result.details.governanceSync).toBe('pubsub');
    expect(result.details.features.aiRateLimit).toBe('redis');
  });

  it('reports unhealthy when PING fails (unavailable)', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(checkRedisConnection).mockResolvedValue({
      healthy: false,
      latency: 5,
      error: 'Connection refused',
    });

    const result = await probeRedisHealth(baseConfig());

    expect(result.healthy).toBe(false);
    expect(result.error).toContain('Connection refused');
    expect(result.details.governanceSync).toBe('poll-only');
  });

  it('uses postgres backends for usage and budget regardless of Redis', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(checkRedisConnection).mockResolvedValue({ healthy: true, latency: 1 });
    vi.mocked(getRedis).mockReturnValue({
      set: vi.fn().mockResolvedValue('OK'),
      get: vi.fn().mockResolvedValue('1'),
    } as never);

    const result = await probeRedisHealth(baseConfig());

    expect(result.details.features.usageCounters).toBe('postgres');
    expect(result.details.features.budgetTracking).toBe('postgres');
  });
});

describe('redis.client reconnect policy', () => {
  it('documents reconnect support in health details', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(false);
    const result = await probeRedisHealth(baseConfig());
    expect(result.details.reconnectSupported).toBe(true);
  });
});
