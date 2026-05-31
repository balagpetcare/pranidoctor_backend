import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AiUsageAnalyticsService,
  resetAiUsageAnalyticsServiceForTests,
} from './ai-usage-analytics.service.js';
import {
  AiUsageReportService,
  resetAiUsageReportServiceForTests,
} from './ai-usage-report.service.js';
import { writeAimsUsageLog } from './ai-usage-log.writer.js';
import { parseAnalyticsDateRange, roundUsd } from './ai-usage-analytics.util.js';

const aiUsageDailyRollupFindMany = vi.fn();
const aiUsageDailyRollupGroupBy = vi.fn();
const aiUsageMonthlyRollupFindMany = vi.fn();
const aiUsageRecordGroupBy = vi.fn();
const aiUsageRecordFindMany = vi.fn();
const aiUsageRecordAggregate = vi.fn();
const aiUsageRecordCount = vi.fn();
const aiUsageLogFindMany = vi.fn();
const aiUsageLogCreate = vi.fn();

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiUsageDailyRollup: {
      findMany: aiUsageDailyRollupFindMany,
      groupBy: aiUsageDailyRollupGroupBy,
    },
    aiUsageMonthlyRollup: { findMany: aiUsageMonthlyRollupFindMany },
    aiUsageRecord: {
      groupBy: aiUsageRecordGroupBy,
      findMany: aiUsageRecordFindMany,
      aggregate: aiUsageRecordAggregate,
      count: aiUsageRecordCount,
    },
    aiUsageLog: {
      findMany: aiUsageLogFindMany,
      create: aiUsageLogCreate,
    },
  }),
}));

vi.mock('../../../../shared/logger/logger.js', () => ({
  getLogger: () => ({ warn: vi.fn(), error: vi.fn() }),
}));

function resetAnalyticsForTests(): void {
  resetAiUsageAnalyticsServiceForTests();
  resetAiUsageReportServiceForTests();
  aiUsageDailyRollupFindMany.mockReset();
  aiUsageDailyRollupGroupBy.mockReset();
  aiUsageMonthlyRollupFindMany.mockReset();
  aiUsageRecordGroupBy.mockReset();
  aiUsageRecordFindMany.mockReset();
  aiUsageRecordAggregate.mockReset();
  aiUsageRecordCount.mockReset();
  aiUsageLogFindMany.mockReset();
  aiUsageLogCreate.mockReset();
}

describe('parseAnalyticsDateRange', () => {
  it('defaults to sinceDays window', () => {
    const { from, to } = parseAnalyticsDateRange({ sinceDays: 7 });
    expect(to.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe('AiUsageAnalyticsService', () => {
  afterEach(resetAnalyticsForTests);

  const from = new Date('2026-05-01T00:00:00.000Z');
  const to = new Date('2026-05-30T23:59:59.999Z');

  it('builds daily cost dashboard from rollups', async () => {
    aiUsageDailyRollupGroupBy.mockResolvedValue([
      {
        bucketDate: new Date('2026-05-10T00:00:00.000Z'),
        _sum: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          costUsd: { toString: () => '0.0025' },
          requestCount: 4,
        },
      },
    ]);

    const service = new AiUsageAnalyticsService();
    const daily = await service.getDailyCost({ from, to });

    expect(daily).toEqual([
      {
        date: '2026-05-10',
        costUsd: 0.0025,
        totalTokens: 150,
        inputTokens: 100,
        outputTokens: 50,
        requests: 4,
      },
    ]);
  });

  it('compares providers with cost share', async () => {
    aiUsageLogFindMany.mockResolvedValue([
      {
        feature: 'CHAT',
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u1',
        success: true,
        isFallback: false,
        errorCode: null,
        inputTokens: 800,
        outputTokens: 200,
        totalTokens: 1000,
        costUsd: { toString: () => '0.03' },
        billable: true,
        latencyMs: 800,
        createdAt: new Date('2026-05-10T10:00:00.000Z'),
      },
      {
        feature: 'CHAT',
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u2',
        success: false,
        isFallback: false,
        errorCode: 'timeout',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: { toString: () => '0' },
        billable: false,
        latencyMs: 5000,
        createdAt: new Date('2026-05-11T10:00:00.000Z'),
      },
      {
        feature: 'CHAT',
        providerKey: 'anthropic',
        modelKey: 'claude-3-haiku',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u3',
        success: true,
        isFallback: false,
        errorCode: null,
        inputTokens: 300,
        outputTokens: 300,
        totalTokens: 600,
        costUsd: { toString: () => '0.01' },
        billable: true,
        latencyMs: 500,
        createdAt: new Date('2026-05-12T10:00:00.000Z'),
      },
    ]);

    const service = new AiUsageAnalyticsService();
    const providers = await service.getProviderComparison({ from, to });

    expect(providers[0]?.provider).toBe('openai');
    expect(providers[0]?.shareOfCostPct).toBe(75);
    expect(providers[1]?.provider).toBe('anthropic');
  });

  it('compares features and identifies top provider per feature', async () => {
    aiUsageLogFindMany.mockResolvedValue([
      {
        feature: 'CHAT',
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u1',
        success: true,
        isFallback: false,
        errorCode: null,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: { toString: () => '0.02' },
        billable: true,
        latencyMs: 400,
        createdAt: new Date('2026-05-10T10:00:00.000Z'),
      },
      {
        feature: 'CHAT',
        providerKey: 'anthropic',
        modelKey: 'claude-3-haiku',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u2',
        success: true,
        isFallback: false,
        errorCode: null,
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10,
        costUsd: { toString: () => '0.005' },
        billable: true,
        latencyMs: 300,
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
      },
      {
        feature: 'FARM_BRIEFING',
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        providerId: null,
        modelId: null,
        organizationId: null,
        branchId: null,
        userId: 'u3',
        success: true,
        isFallback: false,
        errorCode: null,
        inputTokens: 8,
        outputTokens: 4,
        totalTokens: 12,
        costUsd: { toString: () => '0.004' },
        billable: true,
        latencyMs: 350,
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
      },
    ]);

    const service = new AiUsageAnalyticsService();
    const features = await service.getFeatureComparison({ from, to });

    expect(features[0]?.feature).toBe('CHAT');
    expect(features[0]?.topProvider).toBe('openai');
    expect(features[0]?.costUsd).toBe(roundUsd(0.025));
  });

  it('returns full dashboard payload', async () => {
    aiUsageDailyRollupGroupBy.mockResolvedValue([]);
    aiUsageDailyRollupFindMany.mockResolvedValue([]);
    aiUsageMonthlyRollupFindMany.mockResolvedValue([]);
    aiUsageLogFindMany.mockResolvedValue([]);

    const service = new AiUsageAnalyticsService();
    const dashboard = await service.getDashboard({ from, to });

    expect(dashboard.range.from).toBe(from.toISOString());
    expect(dashboard.dailyCost).toEqual([]);
    expect(dashboard.providerComparison).toEqual([]);
  });
});

describe('AiUsageReportService', () => {
  afterEach(resetAnalyticsForTests);

  it('generates CSV report from AIMS logs', async () => {
    aiUsageLogFindMany.mockResolvedValue([
      {
        createdAt: new Date('2026-05-15T10:00:00.000Z'),
        userId: 'user-1',
        branchId: 'branch-a',
        organizationId: 'org-1',
        feature: 'CHAT',
        taskType: 'GENERAL_CHAT',
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: { toString: () => '0.0001' },
        latencyMs: 400,
        success: true,
        errorCode: null,
      },
    ]);
    aiUsageRecordFindMany.mockResolvedValue([]);

    const service = new AiUsageReportService();
    const csv = await service.generateCsv({
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-30T00:00:00.000Z'),
    });

    expect(csv).toContain('timestamp,userId,branchId');
    expect(csv).toContain('user-1');
    expect(csv).toContain('GENERAL_CHAT');
  });
});

describe('writeAimsUsageLog', () => {
  afterEach(resetAnalyticsForTests);

  it('persists provider, model, tokens, cost, user, branch, feature', async () => {
    aiUsageLogCreate.mockResolvedValue({ id: 'log-1' });

    await writeAimsUsageLog(
      {
        feature: 'CHAT',
        taskType: 'GeneralChat',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 20,
        outputTokens: 10,
        latencyMs: 300,
        success: true,
        userId: 'user-1',
        branchId: 'branch-a',
        organizationId: 'org-1',
      },
      0.0002,
      30,
    );

    expect(aiUsageLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          branchId: 'branch-a',
          organizationId: 'org-1',
          feature: 'CHAT',
          taskType: 'GENERAL_CHAT',
          providerKey: 'openai',
          modelKey: 'gpt-4o-mini',
          totalTokens: 30,
          costUsd: 0.0002,
        }),
      }),
    );
  });
});
