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
    aiUsageRecordGroupBy
      .mockResolvedValueOnce([
        {
          provider: 'openai',
          _count: { id: 10 },
          _sum: {
            inputTokens: 1000,
            outputTokens: 500,
            totalTokens: 1500,
            costUsd: { toString: () => '0.03' },
            latencyMs: 8000,
          },
        },
        {
          provider: 'anthropic',
          _count: { id: 5 },
          _sum: {
            inputTokens: 400,
            outputTokens: 200,
            totalTokens: 600,
            costUsd: { toString: () => '0.01' },
            latencyMs: 3000,
          },
        },
      ])
      .mockResolvedValueOnce([
        { provider: 'openai', _count: { id: 9 } },
        { provider: 'anthropic', _count: { id: 5 } },
      ]);

    const service = new AiUsageAnalyticsService();
    const providers = await service.getProviderComparison({ from, to });

    expect(providers[0]?.provider).toBe('openai');
    expect(providers[0]?.shareOfCostPct).toBe(75);
    expect(providers[1]?.provider).toBe('anthropic');
  });

  it('compares features and identifies top provider per feature', async () => {
    aiUsageRecordGroupBy.mockResolvedValueOnce([
      {
        feature: 'CHAT',
        provider: 'openai',
        _count: { id: 8 },
        _sum: { totalTokens: 900, costUsd: { toString: () => '0.02' } },
      },
      {
        feature: 'CHAT',
        provider: 'anthropic',
        _count: { id: 2 },
        _sum: { totalTokens: 200, costUsd: { toString: () => '0.005' } },
      },
      {
        feature: 'FARM_BRIEFING',
        provider: 'openai',
        _count: { id: 3 },
        _sum: { totalTokens: 300, costUsd: { toString: () => '0.004' } },
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
    aiUsageRecordGroupBy.mockResolvedValue([]);
    aiUsageRecordAggregate.mockResolvedValue({
      _count: { id: 0 },
      _sum: { totalTokens: 0, costUsd: { toString: () => '0' } },
    });
    aiUsageRecordCount.mockResolvedValue(0);

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
