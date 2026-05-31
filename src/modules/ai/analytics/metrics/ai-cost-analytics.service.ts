import type {
  AnalyticsSummaryEnvelope,
  CostSummary,
  SummaryFilters,
} from './ai-analytics-summary.types.js';
import {
  aggregateLogs,
  aggregateMonthlyFromDailyMap,
  aggregatePlatformDailyCostFromRollups,
  aggregatePlatformMonthlyFromRollups,
  aggregatePlatformProviderCostFromRollups,
  aggregatePlatformTotalsFromRollups,
  fetchUsageLogs,
  sharePct,
  shouldPreferRollups,
} from './ai-analytics-source.util.js';
import { roundUsd } from '../usage/ai-usage-analytics.util.js';

export class AiCostAnalyticsService {
  readonly name = 'AiCostAnalyticsService';

  async getCostSummary(filters: SummaryFilters): Promise<AnalyticsSummaryEnvelope<CostSummary>> {
    if (shouldPreferRollups(filters)) {
      const [rollup, daily, monthly, providerRollups] = await Promise.all([
        aggregatePlatformTotalsFromRollups(filters),
        aggregatePlatformDailyCostFromRollups(filters),
        aggregatePlatformMonthlyFromRollups(filters),
        aggregatePlatformProviderCostFromRollups(filters),
      ]);

      const byProvider = providerRollups
        .map((row) => ({
          provider: row.provider,
          costUsd: row.costUsd,
          shareOfCostPct: sharePct(row.costUsd, rollup.costUsd),
        }))
        .sort((a, b) => b.costUsd - a.costUsd);

      return {
        range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
        generatedAt: new Date().toISOString(),
        source: 'rollup',
        data: {
          costUsd: rollup.costUsd,
          billableCostUsd: rollup.billableCostUsd,
          avgCostPerRequest:
            rollup.requests > 0 ? roundUsd(rollup.costUsd / rollup.requests) : 0,
          daily,
          monthly,
          byProvider,
        },
      };
    }

    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);

    const daily = [...agg.byDay.entries()]
      .map(([date, stats]) => ({
        date,
        costUsd: roundUsd(stats.costUsd),
        billableCostUsd: roundUsd(stats.billableCostUsd),
        requests: stats.requests,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const monthly = aggregateMonthlyFromDailyMap(agg.byDay);

    const byProvider = [...agg.byProvider.entries()]
      .map(([provider, stats]) => ({
        provider,
        costUsd: roundUsd(stats.costUsd),
        shareOfCostPct: sharePct(stats.costUsd, agg.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: 'log',
      data: {
        costUsd: agg.costUsd,
        billableCostUsd: agg.billableCostUsd,
        avgCostPerRequest: agg.requests > 0 ? roundUsd(agg.costUsd / agg.requests) : 0,
        daily,
        monthly,
        byProvider,
      },
    };
  }
}

let service: AiCostAnalyticsService | null = null;

export function getAiCostAnalyticsService(): AiCostAnalyticsService {
  if (!service) service = new AiCostAnalyticsService();
  return service;
}

export function resetAiCostAnalyticsServiceForTests(): void {
  service = null;
}
