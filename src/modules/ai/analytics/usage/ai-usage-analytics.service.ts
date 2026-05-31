import { getPrisma } from '../../../../shared/database/prisma.js';
import {
  aggregateLogs,
  fetchUsageLogs,
} from '../metrics/ai-analytics-source.util.js';
import type {
  CostTrendPoint,
  DailyCostPoint,
  FeatureComparisonRow,
  MonthlyCostPoint,
  ProviderComparisonRow,
  UsageAnalyticsDashboard,
  UsageAnalyticsFilters,
} from './ai-usage-analytics.types.js';
import {
  buildUsageLogWhere,
  decimalToNumber,
  hasScopedFilters,
  roundRate,
  roundUsd,
  sharePct,
  utcDayStart,
  utcMonthStart,
} from './ai-usage-analytics.util.js';

export class AiUsageAnalyticsService {
  readonly name = 'AiUsageAnalyticsService';

  async getDashboard(filters: UsageAnalyticsFilters): Promise<UsageAnalyticsDashboard> {
    const [
      dailyCost,
      monthlyCost,
      providerComparison,
      featureComparison,
      costTrends,
      topUsers,
      topBranches,
      totals,
    ] = await Promise.all([
      this.getDailyCost(filters),
      this.getMonthlyCost(filters),
      this.getProviderComparison(filters),
      this.getFeatureComparison(filters),
      this.getCostTrends(filters, 'day'),
      this.getTopUsers(filters, 10),
      this.getTopBranches(filters, 10),
      this.getTotals(filters),
    ]);

    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      totals,
      dailyCost,
      monthlyCost,
      providerComparison,
      featureComparison,
      costTrends,
      topUsers,
      topBranches,
    };
  }

  async getTotals(filters: UsageAnalyticsFilters): Promise<UsageAnalyticsDashboard['totals']> {
    if (hasScopedFilters(filters)) {
      return this.totalsFromLogs(filters);
    }

    const prisma = getPrisma();
    const rows = await prisma.aiUsageDailyRollup.findMany({
      where: { bucketDate: { gte: utcDayStart(filters.from), lte: utcDayStart(filters.to) } },
    });

    let requests = 0;
    let successes = 0;
    let failures = 0;
    let totalTokens = 0;
    let costUsd = 0;

    for (const row of rows) {
      requests += row.requestCount;
      successes += row.successCount;
      failures += row.failureCount;
      totalTokens += row.totalTokens;
      costUsd += decimalToNumber(row.costUsd);
    }

    return {
      requests,
      successes,
      failures,
      totalTokens,
      costUsd: roundUsd(costUsd),
    };
  }

  async getDailyCost(filters: UsageAnalyticsFilters): Promise<DailyCostPoint[]> {
    if (hasScopedFilters(filters)) {
      return this.dailyCostFromLogs(filters);
    }

    const prisma = getPrisma();
    const rows = await prisma.aiUsageDailyRollup.groupBy({
      by: ['bucketDate'],
      where: {
        bucketDate: { gte: utcDayStart(filters.from), lte: utcDayStart(filters.to) },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        requestCount: true,
      },
      orderBy: { bucketDate: 'asc' },
    });

    return rows.map((row) => ({
      date: row.bucketDate.toISOString().slice(0, 10),
      costUsd: roundUsd(decimalToNumber(row._sum.costUsd)),
      totalTokens: row._sum.totalTokens ?? 0,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      requests: row._sum.requestCount ?? 0,
    }));
  }

  async getMonthlyCost(filters: UsageAnalyticsFilters): Promise<MonthlyCostPoint[]> {
    const prisma = getPrisma();
    const where = {
      bucketMonth: {
        gte: utcMonthStart(filters.from),
        lte: utcMonthStart(filters.to),
      },
    };

    if (filters.branchId) {
      const rows = await prisma.aiUsageMonthlyRollup.findMany({
        where: {
          ...where,
          dimensionType: 'branch',
          dimensionId: filters.branchId,
        },
        orderBy: { bucketMonth: 'asc' },
      });
      return this.aggregateMonthlyRows(rows, 'branch', filters.branchId);
    }

    if (filters.organizationId) {
      const rows = await prisma.aiUsageMonthlyRollup.findMany({
        where: {
          ...where,
          dimensionType: 'organization',
          dimensionId: filters.organizationId,
        },
        orderBy: { bucketMonth: 'asc' },
      });
      return this.aggregateMonthlyRows(rows, 'organization', filters.organizationId);
    }

    const rows = await prisma.aiUsageMonthlyRollup.findMany({
      where: { ...where, dimensionType: 'platform', dimensionId: 'global' },
      orderBy: { bucketMonth: 'asc' },
    });
    return this.aggregateMonthlyRows(rows, 'platform', 'global');
  }

  async getProviderComparison(filters: UsageAnalyticsFilters): Promise<ProviderComparisonRow[]> {
    const logs = await fetchUsageLogs(filters);
    const agg = aggregateLogs(logs);
    const totalCost = agg.costUsd;

    return [...agg.byProvider.entries()]
      .map(([provider, stats]) => {
        const costUsd = roundUsd(stats.costUsd);
        return {
          provider,
          requests: stats.requests,
          successes: stats.successes,
          failures: stats.failures,
          successRate: roundRate(stats.successes, stats.requests),
          totalTokens: stats.totalTokens,
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
          costUsd,
          avgLatencyMs:
            stats.requests > 0 ? Math.round(stats.latencyMsSum / stats.requests) : 0,
          shareOfCostPct: sharePct(costUsd, totalCost),
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  async getFeatureComparison(filters: UsageAnalyticsFilters): Promise<FeatureComparisonRow[]> {
    const logs = await fetchUsageLogs(filters);
    const byFeature = new Map<
      string,
      { requests: number; totalTokens: number; costUsd: number; providers: Map<string, number> }
    >();

    for (const row of logs) {
      const feature = row.feature ?? 'UNKNOWN';
      const existing = byFeature.get(feature) ?? {
        requests: 0,
        totalTokens: 0,
        costUsd: 0,
        providers: new Map<string, number>(),
      };
      existing.requests += 1;
      existing.totalTokens += row.totalTokens;
      existing.costUsd += decimalToNumber(row.costUsd);
      existing.providers.set(
        row.providerKey,
        (existing.providers.get(row.providerKey) ?? 0) + 1,
      );
      byFeature.set(feature, existing);
    }

    const totalCost = [...byFeature.values()].reduce((sum, row) => sum + row.costUsd, 0);

    return [...byFeature.entries()]
      .map(([feature, stats]) => {
        const topProvider =
          [...stats.providers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
        const costUsd = roundUsd(stats.costUsd);
        return {
          feature,
          requests: stats.requests,
          totalTokens: stats.totalTokens,
          costUsd,
          shareOfCostPct: sharePct(costUsd, totalCost),
          topProvider,
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  async getCostTrends(
    filters: UsageAnalyticsFilters,
    granularity: 'day' | 'week' = 'day',
  ): Promise<CostTrendPoint[]> {
    const daily = await this.getDailyCost(filters);
    if (granularity === 'day') {
      return daily.map((point) => ({
        period: point.date,
        costUsd: point.costUsd,
        totalTokens: point.totalTokens,
        requests: point.requests,
      }));
    }

    const weekly = new Map<string, CostTrendPoint>();
    for (const point of daily) {
      const date = new Date(`${point.date}T00:00:00.000Z`);
      const weekStart = new Date(date);
      weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
      const key = weekStart.toISOString().slice(0, 10);
      const existing = weekly.get(key) ?? {
        period: key,
        costUsd: 0,
        totalTokens: 0,
        requests: 0,
      };
      existing.costUsd = roundUsd(existing.costUsd + point.costUsd);
      existing.totalTokens += point.totalTokens;
      existing.requests += point.requests;
      weekly.set(key, existing);
    }

    return [...weekly.values()].sort((a, b) => a.period.localeCompare(b.period));
  }

  async getTopUsers(filters: UsageAnalyticsFilters, limit = 10) {
    const logs = await fetchUsageLogs(filters);
    const byUser = new Map<string, { requests: number; totalTokens: number; costUsd: number }>();

    for (const row of logs) {
      if (!row.userId) continue;
      const existing = byUser.get(row.userId) ?? { requests: 0, totalTokens: 0, costUsd: 0 };
      existing.requests += 1;
      existing.totalTokens += row.totalTokens;
      existing.costUsd += decimalToNumber(row.costUsd);
      byUser.set(row.userId, existing);
    }

    return [...byUser.entries()]
      .map(([userId, stats]) => ({
        userId,
        requests: stats.requests,
        totalTokens: stats.totalTokens,
        costUsd: roundUsd(stats.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, limit);
  }

  async getTopBranches(filters: UsageAnalyticsFilters, limit = 10) {
    const logs = await fetchUsageLogs(filters);
    const byBranch = new Map<string, { requests: number; totalTokens: number; costUsd: number }>();

    for (const row of logs) {
      if (!row.branchId) continue;
      const existing = byBranch.get(row.branchId) ?? { requests: 0, totalTokens: 0, costUsd: 0 };
      existing.requests += 1;
      existing.totalTokens += row.totalTokens;
      existing.costUsd += decimalToNumber(row.costUsd);
      byBranch.set(row.branchId, existing);
    }

    return [...byBranch.entries()]
      .map(([branchId, stats]) => ({
        branchId,
        requests: stats.requests,
        totalTokens: stats.totalTokens,
        costUsd: roundUsd(stats.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, limit);
  }

  /** Recent AIMS usage log rows for drill-down. */
  async listRecentUsageLogs(filters: UsageAnalyticsFilters, limit = 100) {
    const prisma = getPrisma();
    return prisma.aiUsageLog.findMany({
      where: buildUsageLogWhere(filters),
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        createdAt: true,
        userId: true,
        branchId: true,
        organizationId: true,
        feature: true,
        taskType: true,
        providerKey: true,
        modelKey: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        latencyMs: true,
        success: true,
        errorCode: true,
      },
    });
  }

  private async totalsFromLogs(
    filters: UsageAnalyticsFilters,
  ): Promise<UsageAnalyticsDashboard['totals']> {
    const agg = aggregateLogs(await fetchUsageLogs(filters));
    return {
      requests: agg.requests,
      successes: agg.successes,
      failures: agg.failures,
      totalTokens: agg.totalTokens,
      costUsd: agg.costUsd,
    };
  }

  private async dailyCostFromLogs(filters: UsageAnalyticsFilters): Promise<DailyCostPoint[]> {
    const logs = await fetchUsageLogs(filters);
    const byDay = new Map<string, DailyCostPoint>();

    for (const row of logs) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const existing = byDay.get(date) ?? {
        date,
        costUsd: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requests: 0,
      };
      existing.requests += 1;
      existing.totalTokens += row.totalTokens;
      existing.inputTokens += row.inputTokens;
      existing.outputTokens += row.outputTokens;
      existing.costUsd = roundUsd(existing.costUsd + decimalToNumber(row.costUsd));
      byDay.set(date, existing);
    }

    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private aggregateMonthlyRows(
    rows: Array<{
      bucketMonth: Date;
      totalTokens: number;
      costUsd: { toString(): string };
      requestCount: number;
    }>,
    dimensionType: string,
    dimensionId: string,
  ): MonthlyCostPoint[] {
    const byMonth = new Map<string, MonthlyCostPoint>();

    for (const row of rows) {
      const month = row.bucketMonth.toISOString().slice(0, 7);
      const existing = byMonth.get(month) ?? {
        month,
        costUsd: 0,
        totalTokens: 0,
        requests: 0,
        dimensionType,
        dimensionId,
      };
      existing.requests += row.requestCount;
      existing.totalTokens += row.totalTokens;
      existing.costUsd = roundUsd(existing.costUsd + decimalToNumber(row.costUsd));
      byMonth.set(month, existing);
    }

    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }
}

let aiUsageAnalyticsService: AiUsageAnalyticsService | null = null;

export function getAiUsageAnalyticsService(): AiUsageAnalyticsService {
  if (!aiUsageAnalyticsService) aiUsageAnalyticsService = new AiUsageAnalyticsService();
  return aiUsageAnalyticsService;
}

export function resetAiUsageAnalyticsServiceForTests(): void {
  aiUsageAnalyticsService = null;
}
