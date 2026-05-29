import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiGovernanceService } from './ai-governance.service.js';

const prismaMock = {
  aiGovernanceState: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  aiGovernanceStateHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

vi.mock('../../../shared/config/index.js', () => ({
  getConfig: () => ({ nodeEnv: 'test', redis: { prefix: 'test:' } }),
}));

vi.mock('../../../shared/security/audit/index.js', () => ({
  createAuditLogAsync: vi.fn(),
}));

vi.mock('../usage/ai-usage.service.js', () => ({
  setAiLlmDisabledMetric: vi.fn(),
}));

vi.mock('../../../shared/logger/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('./ai-governance.redis.js', () => ({
  writeGovernanceRedisCache: vi.fn(),
  readGovernanceRedisCache: vi.fn(),
  publishGovernanceChange: vi.fn(),
  createGovernanceSubscriber: vi.fn(),
  governanceRedisKey: (config: { redis: { prefix: string } }, key: string) =>
    `${config.redis.prefix}${key}`,
  parseGovernancePubSubMessage: vi.fn(),
  AI_GOVERNANCE_REDIS_KEYS: {
    llmDisabled: 'ai:governance:llm_disabled',
    version: 'ai:governance:version',
    channel: 'ai:governance:events',
  },
}));

vi.mock('../../../infra/redis/redis.client.js', () => ({
  isRedisInitialized: () => false,
  getRedis: vi.fn(),
}));

describe('AiGovernanceService', () => {
  let service: AiGovernanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiGovernanceService();
    process.env.AI_KILL_SWITCH_PERSISTENCE_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.AI_KILL_SWITCH_PERSISTENCE_ENABLED;
  });

  it('applyLocalState updates hot-path mirror', () => {
    service.applyLocalState(true, 3);
    expect(service.isLlmDisabled()).toBe(true);
    expect(service.getLocalVersion()).toBe(3);
  });

  it('setLlmDisabled persists and bumps version', async () => {
    const existing = {
      id: 'global',
      llmDisabled: false,
      version: BigInt(5),
      updatedAt: new Date(),
      updatedByUserId: null,
      updatedByRole: null,
      reason: null,
      source: 'admin_ui',
    };

    prismaMock.aiGovernanceState.findUnique.mockResolvedValue(existing);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    prismaMock.aiGovernanceState.update.mockResolvedValue({
      ...existing,
      llmDisabled: true,
      version: BigInt(6),
      reason: 'Provider outage during incident',
    });
    prismaMock.aiGovernanceStateHistory.create.mockResolvedValue({ id: 'hist-1' });

    const result = await service.setLlmDisabled({
      llmDisabled: true,
      reason: 'Provider outage during incident',
      actorId: 'admin-1',
      actorRole: 'ADMIN',
      source: 'admin_ui',
    });

    expect(result.llmDisabled).toBe(true);
    expect(result.version).toBe(6);
    expect(service.isLlmDisabled()).toBe(true);
  });

  it('rejects version conflict', async () => {
    prismaMock.aiGovernanceState.findUnique.mockResolvedValue({
      id: 'global',
      llmDisabled: false,
      version: BigInt(2),
      updatedAt: new Date(),
      updatedByUserId: null,
      updatedByRole: null,
      reason: null,
      source: 'admin_ui',
    });

    await expect(
      service.setLlmDisabled({
        llmDisabled: true,
        source: 'admin_ui',
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'AI_GOVERNANCE_VERSION_CONFLICT' });
  });

  it('allows internal_api to enable without SUPER_ADMIN in production', async () => {
    const existing = {
      id: 'global',
      llmDisabled: true,
      version: BigInt(3),
      updatedAt: new Date(),
      updatedByUserId: 'admin-1',
      updatedByRole: 'ADMIN',
      reason: 'incident',
      source: 'admin_ui',
    };

    prismaMock.aiGovernanceState.findUnique.mockResolvedValue(existing);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    );
    prismaMock.aiGovernanceState.update.mockResolvedValue({
      ...existing,
      llmDisabled: false,
      version: BigInt(4),
      source: 'internal_api',
    });
    prismaMock.aiGovernanceStateHistory.create.mockResolvedValue({ id: 'hist-2' });

    const config = { nodeEnv: 'production', redis: { prefix: 'test:' } };
    service = new AiGovernanceService();
    await service.bootstrap(config as never);

    const result = await service.setLlmDisabled({
      llmDisabled: false,
      source: 'internal_api',
    });

    expect(result.llmDisabled).toBe(false);
  });

  it('skips persist when persistence flag is off', async () => {
    process.env.AI_KILL_SWITCH_PERSISTENCE_ENABLED = 'false';
    const result = await service.setLlmDisabled({
      llmDisabled: true,
      source: 'admin_ui',
    });
    expect(result.llmDisabled).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
