import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aggregateLogs } from '../metrics/ai-analytics-source.util.js';
import { resetAiRollupValidationServiceForTests } from './ai-rollup-validation.service.js';
import { ROLLUP_DRIFT_COST_TOLERANCE_USD } from './ai-rollup-validation.types.js';

const mockFindMany = vi.fn();
const mockReconcile = vi.fn();

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiUsageDailyRollup: { findMany: mockFindMany },
  }),
}));

vi.mock('../metrics/ai-analytics-source.util.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../metrics/ai-analytics-source.util.js')>();
  return {
    ...actual,
    fetchUsageLogsForBucket: vi.fn(),
  };
});

vi.mock('../metrics/ai-metrics-aggregator.service.js', () => ({
  getAiMetricsAggregatorService: () => ({
    reconcileDailyMetrics: mockReconcile,
  }),
}));

vi.mock('../metrics/ai-analytics-reconciliation-run.service.js', () => ({
  getAiAnalyticsReconciliationRunService: () => ({
    recordRun: vi.fn().mockResolvedValue('run-1'),
  }),
  persistReconciliationFailure: vi.fn(),
}));

vi.mock('../../alerts/ai-usage-alert.service.js', () => ({
  getAiUsageAlertService: () => ({
    emitAnalyticsReconcileDrift: vi.fn(),
  }),
}));

describe('AiRollupValidationService', () => {
  beforeEach(async () => {
    resetAiRollupValidationServiceForTests();
    mockFindMany.mockReset();
    mockReconcile.mockReset();
    const { fetchUsageLogsForBucket } = await import('../metrics/ai-analytics-source.util.js');
    vi.mocked(fetchUsageLogsForBucket).mockReset();
  });

  it('passes when log totals match rollup totals', async () => {
    const logs = [
      {
        feature: 'chat',
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
        costUsd: { toString: () => '0.001' },
        billable: true,
        latencyMs: 100,
        createdAt: new Date('2026-05-30T12:00:00.000Z'),
      },
    ];
    const { fetchUsageLogsForBucket } = await import('../metrics/ai-analytics-source.util.js');
    vi.mocked(fetchUsageLogsForBucket).mockResolvedValue(logs);
    mockFindMany.mockResolvedValue([
      {
        requestCount: 1,
        costUsd: { toString: () => '0.001' },
        totalTokens: 15,
      },
    ]);

    const { getAiRollupValidationService } = await import('./ai-rollup-validation.service.js');
    const result = await getAiRollupValidationService().compareDailyBucket(new Date('2026-05-30T00:00:00.000Z'));

    expect(result.withinTolerance).toBe(true);
    expect(result.driftRequests).toBe(0);
    expect(Math.abs(result.driftCostUsd)).toBeLessThanOrEqual(ROLLUP_DRIFT_COST_TOLERANCE_USD);
  });

  it('detects drift and auto-repairs once', async () => {
    const logs = [
      {
        feature: 'chat',
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
        costUsd: { toString: () => '0.050' },
        billable: true,
        latencyMs: 100,
        createdAt: new Date('2026-05-30T12:00:00.000Z'),
      },
    ];
    const { fetchUsageLogsForBucket } = await import('../metrics/ai-analytics-source.util.js');
    vi.mocked(fetchUsageLogsForBucket).mockResolvedValue(logs);
    mockFindMany
      .mockResolvedValueOnce([
        { requestCount: 0, costUsd: { toString: () => '0' }, totalTokens: 0 },
      ])
      .mockResolvedValueOnce([
        { requestCount: 1, costUsd: { toString: () => '0.050' }, totalTokens: 15 },
      ]);
    mockReconcile.mockResolvedValue({ dailyRollupsUpserted: 1 });

    const { getAiRollupValidationService } = await import('./ai-rollup-validation.service.js');
    const result = await getAiRollupValidationService().validateDailyBucket(
      new Date('2026-05-30T00:00:00.000Z'),
    );

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(result.autoRepaired).toBe(true);
    expect(result.withinTolerance).toBe(true);
    expect(aggregateLogs(logs).requests).toBe(1);
  });
});
