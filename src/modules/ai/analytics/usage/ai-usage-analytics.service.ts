import { getPrisma } from '../../../../shared/database/prisma.js';
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
  buildUsageRecordWhere,
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
      return this.totalsFromRecords(filters);
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
      return this.dailyCostFromRecords(filters);
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
    const prisma = getPrisma();
    const where = buildUsageRecordWhere(filters);

    const [rows, successRows] = await Promise.all([
      prisma.aiUsageRecord.groupBy({
        by: ['provider'],
        where,
        _count: { id: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
          latencyMs: true,
        },
      }),
      prisma.aiUsageRecord.groupBy({
        by: ['provider'],
        where: { ...where, success: true },
        _count: { id: true },
      }),
    ]);

    const successMap = new Map(successRows.map((r) => [r.provider, r._count.id]));
    const totalCost = rows.reduce((sum, row) => sum + decimalToNumber(row._sum.costUsd), 0);

    return rows
      .map((row) => {
        const requests = row._count.id;
        const successes = successMap.get(row.provider) ?? 0;
        const failures = requests - successes;
        const latencySum = row._sum.latencyMs ?? 0;
        const costUsd = roundUsd(decimalToNumber(row._sum.costUsd));
        return {
          provider: row.provider,
          requests,
          successes,
          failures,
          successRate: roundRate(successes, requests),
          totalTokens: row._sum.totalTokens ?? 0,
          inputTokens: row._sum.inputTokens ?? 0,
          outputTokens: row._sum.outputTokens ?? 0,
          costUsd,
          avgLatencyMs: requests > 0 ? Math.round(latencySum / requests) : 0,
          shareOfCostPct: sharePct(costUsd, totalCost),
        };
      })
      .sort((a, b) => b.costUsd - a.costUsd);
  }

  async getFeatureComparison(filters: UsageAnalyticsFilters): Promise<FeatureComparisonRow[]> {
    const prisma = getPrisma();
    const where = buildUsageRecordWhere(filters);

    const rows = await prisma.aiUsageRecord.groupBy({
      by: ['feature', 'provider'],
      where,
      _count: { id: true },
      _sum: { totalTokens: true, costUsd: true },
    });

    const byFeature = new Map<
      string,
      { requests: number; totalTokens: number; costUsd: number; providers: Map<string, number> }
    >();

    for (const row of rows) {
      const existing = byFeature.get(row.feature) ?? {
        requests: 0,
        totalTokens: 0,
        costUsd: 0,
        providers: new Map<string, number>(),
      };
      existing.requests += row._count.id;
      existing.totalTokens += row._sum.totalTokens ?? 0;
      existing.costUsd += decimalToNumber(row._sum.costUsd);
      existing.providers.set(row.provider, (existing.providers.get(row.provider) ?? 0) + row._count.id);
      byFeature.set(row.feature, existing);
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
    const prisma = getPrisma();
    const where = buildUsageRecordWhere(filters);
    const rows = await prisma.aiUsageRecord.groupBy({
      by: ['userId'],
      where: { ...where, userId: { not: null } },
      _count: { id: true },
      _sum: { totalTokens: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: limit,
    });

    return rows
      .filter((row) => row.userId)
      .map((row) => ({
        userId: row.userId as string,
        requests: row._count.id,
        totalTokens: row._sum.totalTokens ?? 0,
        costUsd: roundUsd(decimalToNumber(row._sum.costUsd)),
      }));
  }

  async getTopBranches(filters: UsageAnalyticsFilters, limit = 10) {
    const prisma = getPrisma();
    const where = buildUsageRecordWhere(filters);
    const rows = await prisma.aiUsageRecord.groupBy({
      by: ['branchId'],
      where: { ...where, branchId: { not: null } },
      _count: { id: true },
      _sum: { totalTokens: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: limit,
    });

    return rows
      .filter((row) => row.branchId)
      .map((row) => ({
        branchId: row.branchId as string,
        requests: row._count.id,
        totalTokens: row._sum.totalTokens ?? 0,
        costUsd: roundUsd(decimalToNumber(row._sum.costUsd)),
      }));
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

  private async totalsFromRecords(
    filters: UsageAnalyticsFilters,
  ): Promise<UsageAnalyticsDashboard['totals']> {
    const prisma = getPrisma();
    const where = buildUsageRecordWhere(filters);
    const [rows, successCount] = await Promise.all([
      prisma.aiUsageRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { totalTokens: true, costUsd: true },
      }),
      prisma.aiUsageRecord.count({ where: { ...where, success: true } }),
    ]);

    const requests = rows._count.id;
    return {
      requests,
      successes: successCount,
      failures: requests - successCount,
      totalTokens: rows._sum.totalTokens ?? 0,
      costUsd: roundUsd(decimalToNumber(rows._sum.costUsd)),
    };
  }

  private async dailyCostFromRecords(filters: UsageAnalyticsFilters): Promise<DailyCostPoint[]> {
    const prisma = getPrisma();
    const rows = await prisma.aiUsageRecord.findMany({
      where: buildUsageRecordWhere(filters),
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
      },
    });

    const byDay = new Map<string, DailyCostPoint>();
    for (const row of rows) {
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
