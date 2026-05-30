import { getPrisma } from '../../../shared/database/prisma.js';
import { getLogger } from '../../../shared/logger/logger.js';

import { getAiBudgetService } from '../budget/ai-budget.service.js';
import { getAiUsageAlertService } from '../alerts/ai-usage-alert.service.js';
import { resolveUsageDimensions } from './ai-usage-dimensions.js';
import { estimateAiCostUsd } from './ai-usage.cost.js';
import { recordAiUsageMetrics } from './ai-usage.metrics.js';
import { buildPlatformRollupFields, buildScopedRollupFields, buildMonthlyRollupFields } from './ai-usage.rollups.js';
import { writeAimsUsageLog } from '../analytics/usage/ai-usage-log.writer.js';
import { AI_RATE_VERSION, accountTokens } from './ai-usage.tokens.js';
import type {
  AiTokenConsumptionSummary,
  AiUsageAttemptInput,
  AiUsageSummary,
} from './ai-usage.types.js';

function utcBucketDate(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcBucketMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function roundRate(successes: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((successes / total) * 10000) / 100;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class AiUsageService {
  readonly name = 'AiUsageService';

  /** Records every orchestrator attempt (success or failure). Non-blocking on persistence. */
  recordAttempt(params: AiUsageAttemptInput): void {
    const costUsd = params.success
      ? estimateAiCostUsd(params.provider, params.model, params.inputTokens, params.outputTokens)
      : 0;
    const tokens = accountTokens({
      provider: params.provider,
      success: params.success,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd,
    });

    recordAiUsageMetrics({
      feature: params.feature,
      provider: params.provider,
      model: params.model,
      success: params.success,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd,
      latencyMs: params.latencyMs,
      ...(params.isFallback !== undefined ? { isFallback: params.isFallback } : {}),
      ...(params.fromProvider !== undefined ? { fromProvider: params.fromProvider } : {}),
      ...(params.errorCode !== undefined ? { errorCode: params.errorCode } : {}),
    });

    void this.persistAttempt(params, costUsd, tokens).catch((err) => {
      getLogger().error(
        { err, feature: params.feature, provider: params.provider },
        'Failed to persist AI usage record',
      );
    });
  }

  /** @deprecated Use recordAttempt — kept for internal compatibility. */
  async record(params: AiUsageAttemptInput): Promise<void> {
    this.recordAttempt(params);
  }

  private async persistAttempt(
    params: AiUsageAttemptInput,
    costUsd: number,
    tokens: ReturnType<typeof accountTokens>,
  ): Promise<void> {
    const prisma = getPrisma();
    const bucketDate = utcBucketDate();
    const bucketMonth = utcBucketMonth();
    const resolvedDims =
      params.organizationId || params.doctorId
        ? {
            organizationId: params.organizationId,
            branchId: params.branchId,
            clinicId: params.clinicId,
            doctorId: params.doctorId,
          }
        : await resolveUsageDimensions(params.userId);

    const rollupKey = {
      bucketDate,
      feature: params.feature,
      provider: params.provider,
      model: params.model,
    };
    const platformRollup = buildPlatformRollupFields(
      rollupKey,
      params.success,
      tokens,
      costUsd,
      params.latencyMs,
    );
    const isTimeout = params.errorCode === 'timeout';

    const monthlyDimensions: Array<{ dimensionType: string; dimensionId: string }> = [
      { dimensionType: 'platform', dimensionId: 'global' },
    ];
    if (resolvedDims.organizationId) {
      monthlyDimensions.push({ dimensionType: 'organization', dimensionId: resolvedDims.organizationId });
    }
    if (resolvedDims.branchId) {
      monthlyDimensions.push({ dimensionType: 'branch', dimensionId: resolvedDims.branchId });
    }
    if (resolvedDims.clinicId) {
      monthlyDimensions.push({ dimensionType: 'clinic', dimensionId: resolvedDims.clinicId });
    }
    if (resolvedDims.doctorId) {
      monthlyDimensions.push({ dimensionType: 'doctor', dimensionId: resolvedDims.doctorId });
    }

    await prisma.$transaction(async (tx) => {
      await tx.aiUsageRecord.create({
        data: {
          userId: params.userId ?? null,
          customerId: params.customerId ?? null,
          organizationId: resolvedDims.organizationId ?? null,
          branchId: resolvedDims.branchId ?? null,
          clinicId: resolvedDims.clinicId ?? null,
          doctorId: resolvedDims.doctorId ?? null,
          feature: params.feature,
          provider: params.provider,
          model: params.model,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          totalTokens: tokens.totalTokens,
          costUsd,
          billable: tokens.billable,
          rateVersion: AI_RATE_VERSION,
          latencyMs: params.latencyMs,
          success: params.success,
          errorCode: params.errorCode ?? null,
          isFallback: params.isFallback ?? false,
        },
      });
      await tx.aiUsageDailyRollup.upsert({
        where: {
          bucketDate_feature_provider_model: {
            bucketDate,
            feature: params.feature,
            provider: params.provider,
            model: params.model,
          },
        },
        create: platformRollup.create,
        update: platformRollup.update,
      });

      for (const dim of monthlyDimensions) {
        const monthlyFields = buildMonthlyRollupFields(
          {
            bucketMonth,
            dimensionType: dim.dimensionType,
            dimensionId: dim.dimensionId,
            provider: params.provider,
            model: params.model,
          },
          params.success,
          tokens,
          costUsd,
          params.latencyMs,
          isTimeout,
        );
        await tx.aiUsageMonthlyRollup.upsert({
          where: {
            bucketMonth_dimensionType_dimensionId_provider_model: {
              bucketMonth,
              dimensionType: dim.dimensionType,
              dimensionId: dim.dimensionId,
              provider: params.provider,
              model: params.model,
            },
          },
          create: monthlyFields.create as never,
          update: monthlyFields.update,
        });
      }

      if (params.userId) {
        const scoped = buildScopedRollupFields(tokens, costUsd);
        await tx.aiUsageUserDailyRollup.upsert({
          where: {
            bucketDate_userId_feature_provider_model: {
              bucketDate,
              userId: params.userId,
              feature: params.feature,
              provider: params.provider,
              model: params.model,
            },
          },
          create: {
            bucketDate,
            userId: params.userId,
            feature: params.feature,
            provider: params.provider,
            model: params.model,
            ...scoped.create,
          },
          update: scoped.update,
        });
      }

      if (params.customerId) {
        const scoped = buildScopedRollupFields(tokens, costUsd);
        await tx.aiUsageCustomerDailyRollup.upsert({
          where: {
            bucketDate_customerId_feature_provider_model: {
              bucketDate,
              customerId: params.customerId,
              feature: params.feature,
              provider: params.provider,
              model: params.model,
            },
          },
          create: {
            bucketDate,
            customerId: params.customerId,
            feature: params.feature,
            provider: params.provider,
            model: params.model,
            ...scoped.create,
          },
          update: scoped.update,
        });
      }
    });

    void writeAimsUsageLog(
      {
        ...params,
        organizationId: resolvedDims.organizationId ?? params.organizationId,
        branchId: resolvedDims.branchId ?? params.branchId,
      },
      costUsd,
      tokens.totalTokens,
    );

    if (tokens.billable) {
      void getAiBudgetService().checkBudgetAfterUsage();
    }
    void this.checkUsageSpike().catch((err) => {
      getLogger().warn({ err }, 'Usage spike check failed');
    });
  }

  private async checkUsageSpike(): Promise<void> {
    const prisma = getPrisma();
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600_000);
    const dayAgo = new Date(now.getTime() - 86400_000);

    const [recentHour, lastDay] = await Promise.all([
      prisma.aiUsageRecord.count({ where: { createdAt: { gte: hourAgo } } }),
      prisma.aiUsageRecord.count({ where: { createdAt: { gte: dayAgo, lt: hourAgo } } }),
    ]);

    const baselineHour = lastDay / 23;
    await getAiUsageAlertService().checkUsageSpike(recentHour, baselineHour);
  }

  async getUsageSummary(since: Date): Promise<AiUsageSummary> {
    const prisma = getPrisma();

    const [rows, successRows, fallbackCount, topUsers, topCustomers] = await Promise.all([
      prisma.aiUsageRecord.groupBy({
        by: ['feature', 'provider', 'model'],
        where: { createdAt: { gte: since } },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
          latencyMs: true,
        },
        _count: { id: true },
      }),
      prisma.aiUsageRecord.groupBy({
        by: ['feature', 'provider', 'model'],
        where: { createdAt: { gte: since }, success: true },
        _count: { id: true },
      }),
      prisma.aiUsageRecord.count({
        where: { createdAt: { gte: since }, isFallback: true, success: true },
      }),
      this.getTopUserConsumers(since, 10),
      this.getTopCustomerConsumers(since, 10),
    ]);

    const billableRows = await prisma.aiUsageRecord.groupBy({
      by: ['feature', 'provider', 'model'],
      where: { createdAt: { gte: since }, billable: true },
      _sum: { totalTokens: true, costUsd: true },
    });
    const billableMap = new Map(
      billableRows.map((r) => [
        `${r.feature}|${r.provider}|${r.model}`,
        {
          billableTokens: r._sum.totalTokens ?? 0,
          billableCostUsd: decimalToNumber(r._sum.costUsd),
        },
      ]),
    );

    const successMap = new Map(
      successRows.map((r) => [`${r.feature}|${r.provider}|${r.model}`, r._count.id]),
    );

    const byFeatureProvider = rows.map((row) => {
      const key = `${row.feature}|${row.provider}|${row.model}`;
      const requests = row._count.id;
      const successes = successMap.get(key) ?? 0;
      const failures = requests - successes;
      const latencySum = row._sum.latencyMs ?? 0;
      const billable = billableMap.get(key) ?? { billableTokens: 0, billableCostUsd: 0 };
      return {
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        requests,
        successes,
        failures,
        successRate: roundRate(successes, requests),
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        totalTokens: row._sum.totalTokens ?? 0,
        billableTokens: billable.billableTokens,
        costUsd: decimalToNumber(row._sum.costUsd),
        billableCostUsd: billable.billableCostUsd,
        avgLatencyMs: requests > 0 ? Math.round(latencySum / requests) : 0,
      };
    });

    const totals = byFeatureProvider.reduce(
      (acc, row) => {
        acc.requests += row.requests;
        acc.successes += row.successes;
        acc.failures += row.failures;
        acc.inputTokens += row.inputTokens;
        acc.outputTokens += row.outputTokens;
        acc.totalTokens += row.totalTokens;
        acc.billableTokens += row.billableTokens;
        acc.costUsd += row.costUsd;
        acc.billableCostUsd += row.billableCostUsd;
        acc.latencyMsSum += row.avgLatencyMs * row.requests;
        return acc;
      },
      {
        requests: 0,
        successes: 0,
        failures: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        billableTokens: 0,
        costUsd: 0,
        billableCostUsd: 0,
        latencyMsSum: 0,
      },
    );

    const byModelMap = new Map<
      string,
      {
        provider: string;
        model: string;
        requests: number;
        totalTokens: number;
        billableTokens: number;
        costUsd: number;
      }
    >();
    for (const row of byFeatureProvider) {
      const key = `${row.provider}|${row.model}`;
      const existing = byModelMap.get(key) ?? {
        provider: row.provider,
        model: row.model,
        requests: 0,
        totalTokens: 0,
        billableTokens: 0,
        costUsd: 0,
      };
      existing.requests += row.requests;
      existing.totalTokens += row.totalTokens;
      existing.billableTokens += row.billableTokens;
      existing.costUsd += row.costUsd;
      byModelMap.set(key, existing);
    }

    return {
      since: since.toISOString(),
      totals: {
        requests: totals.requests,
        successes: totals.successes,
        failures: totals.failures,
        successRate: roundRate(totals.successes, totals.requests),
        failureRate: roundRate(totals.failures, totals.requests),
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        totalTokens: totals.totalTokens,
        billableTokens: totals.billableTokens,
        costUsd: roundUsd(totals.costUsd),
        billableCostUsd: roundUsd(totals.billableCostUsd),
        avgLatencyMs:
          totals.requests > 0 ? Math.round(totals.latencyMsSum / totals.requests) : 0,
        fallbackCount,
      },
      byFeatureProvider,
      byModel: [...byModelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
      topUsers,
      topCustomers,
    };
  }

  /** User token consumption (reads daily rollup — efficient for long windows). */
  async getUserConsumption(userId: string, since: Date): Promise<AiTokenConsumptionSummary> {
    return this.getScopedConsumption('user', userId, since);
  }

  /** Tenant (CustomerProfile) token consumption. */
  async getCustomerConsumption(
    customerId: string,
    since: Date,
  ): Promise<AiTokenConsumptionSummary> {
    return this.getScopedConsumption('customer', customerId, since);
  }

  private async getScopedConsumption(
    scope: 'user' | 'customer',
    id: string,
    since: Date,
  ): Promise<AiTokenConsumptionSummary> {
    const bucketSince = utcBucketDate(since);

    if (scope === 'user') {
      const rows = await getPrisma().aiUsageUserDailyRollup.groupBy({
        by: ['feature'],
        where: { userId: id, bucketDate: { gte: bucketSince } },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          billableTokens: true,
          costUsd: true,
          billableCostUsd: true,
          requestCount: true,
        },
      });
      return this.mapScopedConsumption(since, rows);
    }

    const rows = await getPrisma().aiUsageCustomerDailyRollup.groupBy({
      by: ['feature'],
      where: { customerId: id, bucketDate: { gte: bucketSince } },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        billableTokens: true,
        costUsd: true,
        billableCostUsd: true,
        requestCount: true,
      },
    });
    return this.mapScopedConsumption(since, rows);
  }

  private mapScopedConsumption(
    since: Date,
    rows: Array<{
      feature: string;
      _sum: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
        billableTokens: number | null;
        costUsd: unknown;
        billableCostUsd: unknown;
        requestCount: number | null;
      };
    }>,
  ): AiTokenConsumptionSummary {
    let requests = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let billableTokens = 0;
    let costUsd = 0;
    let billableCostUsd = 0;

    const byFeature = rows.map((row) => {
      requests += row._sum.requestCount ?? 0;
      inputTokens += row._sum.inputTokens ?? 0;
      outputTokens += row._sum.outputTokens ?? 0;
      totalTokens += row._sum.totalTokens ?? 0;
      billableTokens += row._sum.billableTokens ?? 0;
      costUsd += decimalToNumber(row._sum.costUsd as { toString(): string });
      billableCostUsd += decimalToNumber(row._sum.billableCostUsd as { toString(): string });
      return {
        feature: row.feature,
        totalTokens: row._sum.totalTokens ?? 0,
        billableTokens: row._sum.billableTokens ?? 0,
        costUsd: decimalToNumber(row._sum.costUsd as { toString(): string }),
      };
    });

    return {
      since: since.toISOString(),
      requests,
      inputTokens,
      outputTokens,
      totalTokens,
      billableTokens,
      costUsd: roundUsd(costUsd),
      billableCostUsd: roundUsd(billableCostUsd),
      byFeature,
    };
  }

  async getTopUserConsumers(since: Date, limit = 10) {
    const rows = await getPrisma().aiUsageUserDailyRollup.groupBy({
      by: ['userId'],
      where: { bucketDate: { gte: utcBucketDate(since) } },
      _sum: { totalTokens: true, billableTokens: true, costUsd: true },
      orderBy: { _sum: { billableTokens: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({
      userId: r.userId,
      totalTokens: r._sum.totalTokens ?? 0,
      billableTokens: r._sum.billableTokens ?? 0,
      costUsd: decimalToNumber(r._sum.costUsd),
    }));
  }

  async getTopCustomerConsumers(since: Date, limit = 10) {
    const rows = await getPrisma().aiUsageCustomerDailyRollup.groupBy({
      by: ['customerId'],
      where: { bucketDate: { gte: utcBucketDate(since) } },
      _sum: { totalTokens: true, billableTokens: true, costUsd: true },
      orderBy: { _sum: { billableTokens: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({
      customerId: r.customerId,
      totalTokens: r._sum.totalTokens ?? 0,
      billableTokens: r._sum.billableTokens ?? 0,
      costUsd: decimalToNumber(r._sum.costUsd),
    }));
  }

  /** Efficient daily platform rollup read (for long-range reporting). */
  async getDailyRollupSummary(since: Date) {
    const prisma = getPrisma();
    const rows = await prisma.aiUsageDailyRollup.findMany({
      where: { bucketDate: { gte: utcBucketDate(since) } },
      orderBy: { bucketDate: 'desc' },
    });

    return rows.map((row) => ({
      date: row.bucketDate.toISOString().slice(0, 10),
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      requests: row.requestCount,
      successes: row.successCount,
      failures: row.failureCount,
      successRate: roundRate(row.successCount, row.requestCount),
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      billableTokens: row.billableTokens,
      costUsd: decimalToNumber(row.costUsd),
      billableCostUsd: decimalToNumber(row.billableCostUsd),
      avgLatencyMs:
        row.requestCount > 0 ? Math.round(row.latencyMsSum / row.requestCount) : 0,
    }));
  }

  /** Daily cost aggregation by provider and model. */
  async getDailyCostAggregation(since: Date) {
    const prisma = getPrisma();
    const rows = await prisma.aiUsageDailyRollup.groupBy({
      by: ['bucketDate', 'provider', 'model'],
      where: { bucketDate: { gte: utcBucketDate(since) } },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        requestCount: true,
      },
      orderBy: { bucketDate: 'desc' },
    });

    return rows.map((row) => ({
      date: row.bucketDate.toISOString().slice(0, 10),
      provider: row.provider,
      model: row.model,
      tokens: row._sum.totalTokens ?? 0,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      usdCost: decimalToNumber(row._sum.costUsd as { toString(): string }),
      requestCount: row._sum.requestCount ?? 0,
    }));
  }

  /** Monthly cost aggregation by organizational dimension. */
  async getMonthlyCostAggregation(sinceMonth: Date) {
    const prisma = getPrisma();
    const rows = await prisma.aiUsageMonthlyRollup.findMany({
      where: { bucketMonth: { gte: utcBucketMonth(sinceMonth) } },
      orderBy: [{ bucketMonth: 'desc' }, { dimensionType: 'asc' }],
    });

    const byDimension = {
      organization: [] as Array<Record<string, unknown>>,
      branch: [] as Array<Record<string, unknown>>,
      clinic: [] as Array<Record<string, unknown>>,
      doctor: [] as Array<Record<string, unknown>>,
      platform: [] as Array<Record<string, unknown>>,
    };

    for (const row of rows) {
      const entry = {
        month: row.bucketMonth.toISOString().slice(0, 7),
        dimensionId: row.dimensionId,
        provider: row.provider,
        model: row.model,
        tokens: row.totalTokens,
        usdCost: decimalToNumber(row.costUsd),
        requestCount: row.requestCount,
        successRate: roundRate(row.successCount, row.requestCount),
        avgLatencyMs:
          row.requestCount > 0 ? Math.round(row.latencyMsSum / row.requestCount) : 0,
        timeoutRate: roundRate(row.timeoutCount, row.requestCount),
      };
      const key = row.dimensionType as keyof typeof byDimension;
      if (byDimension[key]) {
        byDimension[key].push(entry);
      }
    }

    return byDimension;
  }

  /** Provider-level metrics: latency, failures, success rate, timeout rate. */
  async getProviderMetrics(since: Date) {
    const prisma = getPrisma();
    const rows = await prisma.aiUsageRecord.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since }, provider: { not: 'rules-based' } },
      _count: { id: true },
      _sum: { latencyMs: true },
    });

    const successRows = await prisma.aiUsageRecord.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since }, success: true, provider: { not: 'rules-based' } },
      _count: { id: true },
    });

    const timeoutRows = await prisma.aiUsageRecord.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: since }, errorCode: 'timeout', provider: { not: 'rules-based' } },
      _count: { id: true },
    });

    const successMap = new Map(successRows.map((r) => [r.provider, r._count.id]));
    const timeoutMap = new Map(timeoutRows.map((r) => [r.provider, r._count.id]));

    return rows.map((row) => {
      const requests = row._count.id;
      const successes = successMap.get(row.provider) ?? 0;
      const failures = requests - successes;
      const timeouts = timeoutMap.get(row.provider) ?? 0;
      const latencySum = row._sum.latencyMs ?? 0;
      return {
        provider: row.provider,
        requests,
        successes,
        failures,
        successRate: roundRate(successes, requests),
        failureRate: roundRate(failures, requests),
        timeoutRate: roundRate(timeouts, requests),
        avgLatencyMs: requests > 0 ? Math.round(latencySum / requests) : 0,
      };
    });
  }
}

let service: AiUsageService | null = null;

export function getAiUsageService(): AiUsageService {
  if (!service) service = new AiUsageService();
  return service;
}

export { renderAiUsagePrometheusLines, setAiLlmDisabledMetric } from './ai-usage.metrics.js';
