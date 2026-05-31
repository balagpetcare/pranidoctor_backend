import type {
  AnalyticsSummaryEnvelope,
  SummaryFilters,
  UsageSummary,
} from './ai-analytics-summary.types.js';
import {
  aggregateLogs,
  aggregatePlatformTotalsFromRollups,
  fetchUsageLogs,
  shouldPreferRollups,
} from './ai-analytics-source.util.js';
import { roundRate } from '../usage/ai-usage-analytics.util.js';

export class AiUsageAnalyticsSummaryService {
  readonly name = 'AiUsageAnalyticsSummaryService';

  async getUsageSummary(filters: SummaryFilters): Promise<AnalyticsSummaryEnvelope<UsageSummary>> {
    if (shouldPreferRollups(filters)) {
      const rollup = await aggregatePlatformTotalsFromRollups(filters);
      const logs = await fetchUsageLogs(filters);
      const logAgg = aggregateLogs(logs);

      return {
        range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
        generatedAt: new Date().toISOString(),
        source: 'rollup',
        data: {
          requests: rollup.requests,
          successes: rollup.successes,
          failures: rollup.failures,
          successRate: roundRate(rollup.successes, rollup.requests),
          totalTokens: rollup.totalTokens,
          inputTokens: rollup.inputTokens,
          outputTokens: rollup.outputTokens,
          uniqueUsers: logAgg.uniqueUsers,
          uniqueBranches: logAgg.uniqueBranches,
          fallbackCount: logAgg.fallbackCount,
          byFeature: [...logAgg.byFeature.entries()]
            .map(([feature, stats]) => ({
              feature,
              requests: stats.requests,
              totalTokens: stats.totalTokens,
            }))
            .sort((a, b) => b.requests - a.requests),
        },
      };
    }

    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: 'log',
      data: {
        requests: agg.requests,
        successes: agg.successes,
        failures: agg.failures,
        successRate: agg.successRate,
        totalTokens: agg.totalTokens,
        inputTokens: agg.inputTokens,
        outputTokens: agg.outputTokens,
        uniqueUsers: agg.uniqueUsers,
        uniqueBranches: agg.uniqueBranches,
        fallbackCount: agg.fallbackCount,
        byFeature: [...agg.byFeature.entries()]
          .map(([feature, stats]) => ({
            feature,
            requests: stats.requests,
            totalTokens: stats.totalTokens,
          }))
          .sort((a, b) => b.requests - a.requests),
      },
    };
  }
}

let service: AiUsageAnalyticsSummaryService | null = null;

export function getAiUsageAnalyticsSummaryService(): AiUsageAnalyticsSummaryService {
  if (!service) service = new AiUsageAnalyticsSummaryService();
  return service;
}

export function resetAiUsageAnalyticsSummaryServiceForTests(): void {
  service = null;
}
