import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  aggregateLogs,
  buildDailyRollupBuckets,
  buildMonthlyRollupBuckets,
  categorizeErrorCode,
  fetchUsageLogsForBucket,
  percentile,
} from './ai-analytics-source.util.js';
import {
  AiCostAnalyticsService,
  AiMetricsAggregatorService,
  AiModelAnalyticsService,
  AiPerformanceAnalyticsService,
  AiProviderAnalyticsService,
  AiUsageAnalyticsSummaryService,
  resetAiCostAnalyticsServiceForTests,
  resetAiMetricsAggregatorServiceForTests,
  resetAiModelAnalyticsServiceForTests,
  resetAiPerformanceAnalyticsServiceForTests,
  resetAiProviderAnalyticsServiceForTests,
  resetAiUsageAnalyticsSummaryServiceForTests,
} from './index.js';
import type { LogAggregateRow } from './ai-analytics-source.util.js';

const aiUsageLogFindMany = vi.fn();
const aiUsageDailyRollupFindMany = vi.fn();
const aiUsageDailyRollupGroupBy = vi.fn();
const aiUsageDailyRollupUpsert = vi.fn();
const aiUsageMonthlyRollupFindMany = vi.fn();
const aiUsageMonthlyRollupUpsert = vi.fn();
const aiProviderFindMany = vi.fn();
const aiModelFindMany = vi.fn();

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiUsageLog: { findMany: aiUsageLogFindMany },
    aiUsageDailyRollup: {
      findMany: aiUsageDailyRollupFindMany,
      groupBy: aiUsageDailyRollupGroupBy,
      upsert: aiUsageDailyRollupUpsert,
    },
    aiUsageMonthlyRollup: {
      findMany: aiUsageMonthlyRollupFindMany,
      upsert: aiUsageMonthlyRollupUpsert,
    },
    aiProvider: { findMany: aiProviderFindMany },
    aiModel: { findMany: aiModelFindMany },
  }),
}));

vi.mock('../../../../shared/logger/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function sampleLog(overrides: Partial<LogAggregateRow> = {}): LogAggregateRow {
  return {
    feature: 'CHAT',
    providerKey: 'openai',
    modelKey: 'gpt-4o-mini',
    providerId: 'prov-1',
    modelId: 'model-1',
    organizationId: 'org-1',
    branchId: 'branch-a',
    userId: 'user-1',
    success: true,
    isFallback: false,
    errorCode: null,
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    costUsd: { toString: () => '0.0002' },
    billable: true,
    latencyMs: 400,
    createdAt: new Date('2026-05-15T10:00:00.000Z'),
    ...overrides,
  };
}

function resetMocks(): void {
  resetAiUsageAnalyticsSummaryServiceForTests();
  resetAiCostAnalyticsServiceForTests();
  resetAiProviderAnalyticsServiceForTests();
  resetAiModelAnalyticsServiceForTests();
  resetAiPerformanceAnalyticsServiceForTests();
  resetAiMetricsAggregatorServiceForTests();
  aiUsageLogFindMany.mockReset();
  aiUsageDailyRollupFindMany.mockReset();
  aiUsageDailyRollupGroupBy.mockReset();
  aiUsageDailyRollupUpsert.mockReset();
  aiUsageMonthlyRollupFindMany.mockReset();
  aiUsageMonthlyRollupUpsert.mockReset();
  aiProviderFindMany.mockReset();
  aiModelFindMany.mockReset();
}

describe('ai-analytics-source.util', () => {
  it('categorizes error codes', () => {
    expect(categorizeErrorCode('429')).toBe('RATE_LIMIT');
    expect(categorizeErrorCode('timeout')).toBe('TIMEOUT');
    expect(categorizeErrorCode('invalid_api_key')).toBe('AUTH');
  });

  it('computes latency percentiles', () => {
    expect(percentile([100, 200, 300, 400, 500], 50)).toBe(300);
    expect(percentile([100, 200, 300, 400, 500], 95)).toBe(500);
  });

  it('builds daily rollup buckets from logs', () => {
    const buckets = buildDailyRollupBuckets(
      [sampleLog(), sampleLog({ outputTokens: 8, totalTokens: 18 })],
      new Date('2026-05-15T00:00:00.000Z'),
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.requestCount).toBe(2);
    expect(buckets[0]?.totalTokens).toBe(33);
  });

  it('builds monthly rollup buckets with org and branch dimensions', () => {
    const buckets = buildMonthlyRollupBuckets(
      [sampleLog()],
      new Date('2026-05-01T00:00:00.000Z'),
    );
    expect(buckets.length).toBeGreaterThanOrEqual(3);
    expect(buckets.some((b) => b.dimensionType === 'platform')).toBe(true);
    expect(buckets.some((b) => b.dimensionType === 'organization')).toBe(true);
    expect(buckets.some((b) => b.dimensionType === 'branch')).toBe(true);
  });

  it('aggregates logs into provider and model stats', () => {
    const agg = aggregateLogs([
      sampleLog(),
      sampleLog({
        providerKey: 'anthropic',
        modelKey: 'claude-3-haiku',
        providerId: 'prov-2',
        modelId: 'model-2',
        success: false,
        errorCode: 'timeout',
        isFallback: true,
      }),
    ]);
    expect(agg.requests).toBe(2);
    expect(agg.fallbackCount).toBe(1);
    expect(agg.byProvider.size).toBe(2);
    expect(agg.byModel.size).toBe(2);
  });

  it('preserves token and cost totals in aggregateLogs', () => {
    const agg = aggregateLogs([
      sampleLog({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
      sampleLog({
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        costUsd: { toString: () => '0.0003' },
      }),
    ]);
    expect(agg.inputTokens).toBe(120);
    expect(agg.outputTokens).toBe(60);
    expect(agg.totalTokens).toBe(180);
    expect(agg.costUsd).toBe(0.0005);
  });

  it('uses exclusive end boundary for bucket log fetch', async () => {
    aiUsageLogFindMany.mockResolvedValue([]);
    await fetchUsageLogsForBucket(
      new Date('2026-05-15T00:00:00.000Z'),
      new Date('2026-05-16T00:00:00.000Z'),
    );
    expect(aiUsageLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-05-15T00:00:00.000Z'),
            lt: new Date('2026-05-16T00:00:00.000Z'),
          },
        }),
      }),
    );
  });
});

describe('Phase 5 analytics summary services', () => {
  afterEach(resetMocks);

  const from = new Date('2026-05-01T00:00:00.000Z');
  const to = new Date('2026-05-30T23:59:59.999Z');
  const filters = { from, to };

  it('returns usage summary from rollups + logs', async () => {
    aiUsageDailyRollupFindMany.mockResolvedValue([
      {
        requestCount: 10,
        successCount: 9,
        failureCount: 1,
        totalTokens: 150,
        inputTokens: 100,
        outputTokens: 50,
        costUsd: { toString: () => '0.03' },
        billableCostUsd: { toString: () => '0.03' },
        latencyMsSum: 8000,
      },
    ]);
    aiUsageLogFindMany.mockResolvedValue([
      sampleLog(),
      sampleLog({ userId: 'user-2', branchId: 'branch-b', isFallback: true }),
    ]);

    const summary = await new AiUsageAnalyticsSummaryService().getUsageSummary(filters);

    expect(summary.source).toBe('rollup');
    expect(summary.data.requests).toBe(10);
    expect(summary.data.uniqueUsers).toBe(2);
    expect(summary.data.fallbackCount).toBe(1);
  });

  it('returns cost summary with provider breakdown', async () => {
    aiUsageDailyRollupFindMany.mockResolvedValue([
      {
        requestCount: 5,
        successCount: 5,
        failureCount: 0,
        totalTokens: 100,
        inputTokens: 60,
        outputTokens: 40,
        costUsd: { toString: () => '0.02' },
        billableCostUsd: { toString: () => '0.02' },
        latencyMsSum: 2000,
      },
    ]);
    aiUsageDailyRollupGroupBy
      .mockResolvedValueOnce([
        {
          bucketDate: new Date('2026-05-10T00:00:00.000Z'),
          _sum: {
            costUsd: { toString: () => '0.02' },
            billableCostUsd: { toString: () => '0.02' },
            requestCount: 5,
            totalTokens: 100,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          provider: 'openai',
          _sum: {
            costUsd: { toString: () => '0.02' },
            requestCount: 5,
            totalTokens: 100,
          },
        },
      ]);
    aiUsageMonthlyRollupFindMany.mockResolvedValue([]);

    const summary = await new AiCostAnalyticsService().getCostSummary(filters);

    expect(summary.data.costUsd).toBe(0.02);
    expect(summary.data.byProvider[0]?.provider).toBe('openai');
  });

  it('returns provider summary with registry metadata', async () => {
    aiUsageLogFindMany.mockResolvedValue([sampleLog()]);
    aiUsageDailyRollupFindMany.mockResolvedValue([
      {
        requestCount: 1,
        successCount: 1,
        failureCount: 0,
        totalTokens: 15,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: { toString: () => '0.0002' },
        billableCostUsd: { toString: () => '0.0002' },
        latencyMsSum: 400,
      },
    ]);
    aiProviderFindMany.mockResolvedValue([
      { id: 'prov-1', healthScore: 0.95, enabled: true },
    ]);

    const summary = await new AiProviderAnalyticsService().getProviderSummary(filters);

    expect(summary.data.providers[0]?.healthScore).toBe(0.95);
    expect(summary.data.providers[0]?.enabled).toBe(true);
  });

  it('returns model summary grouped by family', async () => {
    aiUsageLogFindMany.mockResolvedValue([sampleLog()]);
    aiUsageDailyRollupFindMany.mockResolvedValue([
      {
        requestCount: 1,
        successCount: 1,
        failureCount: 0,
        totalTokens: 15,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: { toString: () => '0.0002' },
        billableCostUsd: { toString: () => '0.0002' },
        latencyMsSum: 400,
      },
    ]);
    aiModelFindMany.mockResolvedValue([{ id: 'model-1', modelFamily: 'gpt' }]);

    const summary = await new AiModelAnalyticsService().getModelSummary(filters);

    expect(summary.data.models[0]?.modelFamily).toBe('gpt');
    expect(summary.data.byFamily[0]?.family).toBe('gpt');
  });

  it('returns performance summary with error taxonomy', async () => {
    aiUsageLogFindMany.mockResolvedValue([
      sampleLog(),
      sampleLog({ success: false, errorCode: 'timeout', latencyMs: 12000 }),
    ]);

    const summary = await new AiPerformanceAnalyticsService().getPerformanceSummary(filters);

    expect(summary.data.timeoutCount).toBe(1);
    expect(summary.data.byErrorCategory.some((e) => e.category === 'TIMEOUT')).toBe(true);
    expect(summary.data.latencyHistogram.length).toBeGreaterThan(0);
  });

  it('reconciles daily metrics into existing rollups', async () => {
    aiUsageLogFindMany.mockResolvedValue([sampleLog()]);
    aiUsageDailyRollupUpsert.mockResolvedValue({});

    const result = await new AiMetricsAggregatorService().reconcileDailyMetrics(
      new Date('2026-05-15T00:00:00.000Z'),
    );

    expect(result.logCount).toBe(1);
    expect(result.dailyRollupsUpserted).toBe(1);
    expect(aiUsageDailyRollupUpsert).toHaveBeenCalledTimes(1);
  });

  it('reconciles monthly metrics into existing rollups', async () => {
    aiUsageLogFindMany.mockResolvedValue([sampleLog()]);
    aiUsageMonthlyRollupUpsert.mockResolvedValue({});

    const result = await new AiMetricsAggregatorService().reconcileMonthlyMetrics(
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(result.monthlyRollupsUpserted).toBeGreaterThan(0);
    expect(aiUsageMonthlyRollupUpsert).toHaveBeenCalled();
  });
});
