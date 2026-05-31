import type {
  AnalyticsSummaryEnvelope,
  PerformanceSummary,
  SummaryFilters,
} from './ai-analytics-summary.types.js';
import {
  aggregateLogs,
  buildLatencyHistogram,
  fetchUsageLogs,
  shouldPreferRollups,
} from './ai-analytics-source.util.js';
import { roundRate } from '../usage/ai-usage-analytics.util.js';

export class AiPerformanceAnalyticsService {
  readonly name = 'AiPerformanceAnalyticsService';

  async getPerformanceSummary(
    filters: SummaryFilters,
  ): Promise<AnalyticsSummaryEnvelope<PerformanceSummary>> {
    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);
    const failureCount = agg.failures;
    const errorTotal = [...agg.errorCategories.values()].reduce((sum, n) => sum + n, 0);

    const byErrorCategory = [...agg.errorCategories.entries()]
      .map(([category, count]) => ({
        category,
        count,
        sharePct: roundRate(count, errorTotal),
      }))
      .sort((a, b) => b.count - a.count);

    const topErrorCodes = [...agg.errorCodes.entries()]
      .map(([errorCode, count]) => ({ errorCode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: shouldPreferRollups(filters) ? 'rollup' : 'log',
      data: {
        successRate: agg.successRate,
        failureRate: roundRate(failureCount, agg.requests),
        avgLatencyMs: agg.avgLatencyMs,
        p50LatencyMs: agg.p50LatencyMs,
        p95LatencyMs: agg.p95LatencyMs,
        timeoutCount: agg.timeoutCount,
        fallbackCount: agg.fallbackCount,
        fallbackRate: roundRate(agg.fallbackCount, agg.requests),
        errorRate: roundRate(failureCount, agg.requests),
        byErrorCategory,
        topErrorCodes,
        latencyHistogram: buildLatencyHistogram(agg.latencies),
      },
    };
  }
}

let service: AiPerformanceAnalyticsService | null = null;

export function getAiPerformanceAnalyticsService(): AiPerformanceAnalyticsService {
  if (!service) service = new AiPerformanceAnalyticsService();
  return service;
}

export function resetAiPerformanceAnalyticsServiceForTests(): void {
  service = null;
}
