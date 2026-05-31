import { beforeEach, describe, expect, it, vi } from 'vitest';

const listRecentUsageLogs = vi.hoisted(() => vi.fn());
const aiUsageRecordFindMany = vi.hoisted(() => vi.fn());

vi.mock('./ai-usage-analytics.service.js', () => ({
  getAiUsageAnalyticsService: () => ({
    listRecentUsageLogs,
  }),
}));

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiUsageRecord: { findMany: aiUsageRecordFindMany },
  }),
}));

describe('AiUsageReportService logs-only path', () => {
  beforeEach(() => {
    listRecentUsageLogs.mockReset();
    aiUsageRecordFindMany.mockReset();
  });

  it('reads only from AiUsageLog via analytics service', async () => {
    listRecentUsageLogs.mockResolvedValue([
      {
        createdAt: new Date('2026-05-30T12:00:00.000Z'),
        userId: 'u1',
        branchId: 'b1',
        organizationId: 'o1',
        feature: 'chat',
        taskType: null,
        providerKey: 'openai',
        modelKey: 'gpt-4o-mini',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: { toString: () => '0.001' },
        latencyMs: 100,
        success: true,
        errorCode: null,
      },
    ]);

    const { getAiUsageReportService, resetAiUsageReportServiceForTests } = await import(
      './ai-usage-report.service.js'
    );
    resetAiUsageReportServiceForTests();
    const { from, to } = (await import('./ai-usage-analytics.util.js')).parseAnalyticsDateRange({
      sinceDays: 7,
    });
    const report = await getAiUsageReportService().generateReport({ from, to });

    expect(listRecentUsageLogs).toHaveBeenCalledTimes(1);
    expect(aiUsageRecordFindMany).not.toHaveBeenCalled();
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.provider).toBe('openai');
  });

  it('returns empty report when logs empty without legacy fallback', async () => {
    listRecentUsageLogs.mockResolvedValue([]);
    const { getAiUsageReportService, resetAiUsageReportServiceForTests } = await import(
      './ai-usage-report.service.js'
    );
    resetAiUsageReportServiceForTests();
    const { from, to } = (await import('./ai-usage-analytics.util.js')).parseAnalyticsDateRange({
      sinceDays: 7,
    });
    const report = await getAiUsageReportService().generateReport({ from, to });
    expect(report.rows).toHaveLength(0);
    expect(aiUsageRecordFindMany).not.toHaveBeenCalled();
  });
});
