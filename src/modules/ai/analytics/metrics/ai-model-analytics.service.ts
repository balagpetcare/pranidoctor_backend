import { getPrisma } from '../../../../shared/database/prisma.js';
import type {
  AnalyticsSummaryEnvelope,
  ModelSummary,
  SummaryFilters,
} from './ai-analytics-summary.types.js';
import {
  aggregateLogs,
  aggregatePlatformTotalsFromRollups,
  fetchUsageLogs,
  sharePct,
  shouldPreferRollups,
} from './ai-analytics-source.util.js';
import { roundUsd } from '../usage/ai-usage-analytics.util.js';

export class AiModelAnalyticsService {
  readonly name = 'AiModelAnalyticsService';

  async getModelSummary(filters: SummaryFilters): Promise<AnalyticsSummaryEnvelope<ModelSummary>> {
    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);
    const totalCostUsd = shouldPreferRollups(filters)
      ? (await aggregatePlatformTotalsFromRollups(filters)).costUsd
      : agg.costUsd;

    const modelIds = [...agg.byModel.values()]
      .map((m) => m.modelId)
      .filter((id): id is string => Boolean(id));

    const registry = await this.loadModelRegistry(modelIds);

    const models = [...agg.byModel.entries()]
      .map(([key, stats]) => {
        const modelKey = key.split(':').slice(1).join(':');
        const meta = stats.modelId ? registry.get(stats.modelId) : undefined;
        const costUsd = roundUsd(stats.costUsd);
        return {
          model: modelKey,
          modelId: stats.modelId,
          provider: stats.provider,
          modelFamily: meta?.modelFamily ?? null,
          requests: stats.requests,
          successes: stats.successes,
          totalTokens: stats.totalTokens,
          costUsd,
          avgLatencyMs:
            stats.requests > 0 ? Math.round(stats.latencyMsSum / stats.requests) : 0,
          shareOfCostPct: sharePct(costUsd, totalCostUsd),
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);

    const byFamilyMap = new Map<string, { requests: number; costUsd: number }>();
    for (const model of models) {
      const family = model.modelFamily ?? 'unknown';
      const existing = byFamilyMap.get(family) ?? { requests: 0, costUsd: 0 };
      existing.requests += model.requests;
      existing.costUsd += model.costUsd;
      byFamilyMap.set(family, existing);
    }

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: shouldPreferRollups(filters) ? 'rollup' : 'log',
      data: {
        models,
        totalCostUsd: roundUsd(totalCostUsd),
        byFamily: [...byFamilyMap.entries()]
          .map(([family, stats]) => ({
            family,
            requests: stats.requests,
            costUsd: roundUsd(stats.costUsd),
          }))
          .sort((a, b) => b.costUsd - a.costUsd),
      },
    };
  }

  private async loadModelRegistry(modelIds: string[]) {
    const map = new Map<string, { modelFamily: string | null }>();
    if (modelIds.length === 0) return map;

    const prisma = getPrisma();
    const rows = await prisma.aiModel.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, modelFamily: true },
    });
    for (const row of rows) {
      map.set(row.id, { modelFamily: row.modelFamily });
    }
    return map;
  }
}

let service: AiModelAnalyticsService | null = null;

export function getAiModelAnalyticsService(): AiModelAnalyticsService {
  if (!service) service = new AiModelAnalyticsService();
  return service;
}

export function resetAiModelAnalyticsServiceForTests(): void {
  service = null;
}
