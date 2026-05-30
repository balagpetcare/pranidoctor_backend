import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppConfig } from '../config/config.schema.js';

vi.mock('../../infra/redis/redis.client.js', () => ({
  isRedisInitialized: vi.fn(),
}));

vi.mock('../../infra/redis/redis.health.js', () => ({
  probeRedisHealth: vi.fn(),
}));

vi.mock('../database/prisma.js', () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue({ healthy: true, latency: 1 }),
}));

vi.mock('../../modules/media/storage/storage.factory.js', () => ({
  degradeStorageRuntime: vi.fn(),
  getStorage: vi.fn(),
  isStorageEnabled: vi.fn().mockReturnValue(false),
  isStorageRuntimeDegraded: vi.fn().mockReturnValue(false),
}));

vi.mock('./env.resolver.js', () => ({
  resolveEnvUrls: vi.fn().mockReturnValue({
    databaseUrl: 'postgres://localhost/db',
    redisUrl: 'redis://localhost:6379',
    minioUrl: 'http://localhost:9000',
  }),
}));

vi.mock('./mobile-profile-startup.js', () => ({
  validateMobileProfileModulesCheck: vi.fn().mockResolvedValue({ name: 'mobile-modules', healthy: true }),
}));

vi.mock('../../modules/ai/config/ai.config.js', () => ({
  validateAiSecrets: vi.fn().mockResolvedValue({ ok: true, errors: [], warnings: [] }),
}));

vi.mock('../../modules/ai/orchestrator/providers/provider.validation.js', () => ({
  validateAllLlmProviders: vi.fn().mockReturnValue([]),
}));

import { isRedisInitialized } from '../../infra/redis/redis.client.js';
import { probeRedisHealth } from '../../infra/redis/redis.health.js';
import { validateStartup } from './startup-validation.js';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'production',
    port: 3000,
    appName: 'test',
    appVersion: '1.0.0',
    skipStartupValidation: false,
    storage: { enabled: false, driver: 'disabled' },
    ai: { llmRequired: false, healthProbeEnabled: false },
    redis: { enabled: true, url: 'redis://localhost:6379', host: 'localhost', port: 6379, prefix: 'pd:' },
    ...overrides,
  } as AppConfig;
}

describe('validateStartup redis checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails production boot when REDIS_ENABLED=false', async () => {
    const result = await validateStartup(
      baseConfig({
        redis: { enabled: false, url: '', host: 'localhost', port: 6379, prefix: 'pd:' },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.checks.some((c) => c.name === 'redis-config' && !c.healthy)).toBe(true);
  });

  it('fails when Redis enabled but client not initialized in production', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(false);

    const result = await validateStartup(baseConfig());

    expect(result.ok).toBe(false);
    const redisCheck = result.checks.find((c) => c.name === 'redis');
    expect(redisCheck?.healthy).toBe(false);
    expect(redisCheck?.error).toContain('not initialized');
  });

  it('passes when probe succeeds', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(probeRedisHealth).mockResolvedValue({
      healthy: true,
      latency: 3,
      details: {
        enabled: true,
        initialized: true,
        prefix: 'pd:',
        connected: true,
        pingLatencyMs: 3,
        probeWriteOk: true,
        rateLimitBackend: 'available',
        governanceSync: 'pubsub',
        reconnectSupported: true,
        features: {
          aiRateLimit: 'redis',
          governanceSync: 'redis',
          usageCounters: 'postgres',
          budgetTracking: 'postgres',
          sessions: 'redis',
          queues: 'redis',
          areaCache: 'redis',
        },
      },
    });

    const result = await validateStartup(baseConfig());

    expect(result.ok).toBe(true);
    expect(result.checks.find((c) => c.name === 'redis')?.healthy).toBe(true);
  });

  it('allows dev to continue when Redis probe fails', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(probeRedisHealth).mockResolvedValue({
      healthy: false,
      latency: 10,
      error: 'Connection refused',
      details: {} as never,
    });

    const result = await validateStartup(baseConfig({ nodeEnv: 'development' }));

    expect(result.ok).toBe(true);
    const redisCheck = result.checks.find((c) => c.name === 'redis');
    expect(redisCheck?.healthy).toBe(false);
    expect(redisCheck?.optional).toBe(true);
  });
});
