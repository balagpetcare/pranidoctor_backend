import { getPrisma } from '../../../../shared/database/prisma.js';
import type {
  AnalyticsSummaryEnvelope,
  ProviderSummary,
  SummaryFilters,
} from './ai-analytics-summary.types.js';
import {
  aggregateLogs,
  aggregatePlatformTotalsFromRollups,
  fetchUsageLogs,
  sharePct,
  shouldPreferRollups,
} from './ai-analytics-source.util.js';
import { roundRate, roundUsd } from '../usage/ai-usage-analytics.util.js';

export class AiProviderAnalyticsService {
  readonly name = 'AiProviderAnalyticsService';

  async getProviderSummary(
    filters: SummaryFilters,
  ): Promise<AnalyticsSummaryEnvelope<ProviderSummary>> {
    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);
    const totalCostUsd = shouldPreferRollups(filters)
      ? (await aggregatePlatformTotalsFromRollups(filters)).costUsd
      : agg.costUsd;

    const providerIds = [...agg.byProvider.values()]
      .map((p) => p.providerId)
      .filter((id): id is string => Boolean(id));

    const registry = await this.loadProviderRegistry(providerIds);

    const providers = [...agg.byProvider.entries()]
      .map(([provider, stats]) => {
        const meta = stats.providerId ? registry.get(stats.providerId) : undefined;
        const costUsd = roundUsd(stats.costUsd);
        return {
          provider,
          providerId: stats.providerId,
          requests: stats.requests,
          successes: stats.successes,
          failures: stats.failures,
          successRate: roundRate(stats.successes, stats.requests),
          totalTokens: stats.totalTokens,
          costUsd,
          avgLatencyMs:
            stats.requests > 0 ? Math.round(stats.latencyMsSum / stats.requests) : 0,
          fallbackCount: stats.fallbackCount,
          shareOfCostPct: sharePct(costUsd, totalCostUsd),
          healthScore: meta?.healthScore ?? null,
          enabled: meta?.enabled ?? null,
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: shouldPreferRollups(filters) ? 'rollup' : 'log',
      data: {
        providers,
        totalCostUsd: roundUsd(totalCostUsd),
      },
    };
  }

  private async loadProviderRegistry(providerIds: string[]) {
    const map = new Map<string, { healthScore: number; enabled: boolean }>();
    if (providerIds.length === 0) return map;

    const prisma = getPrisma();
    const rows = await prisma.aiProvider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, healthScore: true, enabled: true },
    });
    for (const row of rows) {
      map.set(row.id, { healthScore: row.healthScore, enabled: row.enabled });
    }
    return map;
  }
}

let service: AiProviderAnalyticsService | null = null;

export function getAiProviderAnalyticsService(): AiProviderAnalyticsService {
  if (!service) service = new AiProviderAnalyticsService();
  return service;
}

export function resetAiProviderAnalyticsServiceForTests(): void {
  service = null;
}
