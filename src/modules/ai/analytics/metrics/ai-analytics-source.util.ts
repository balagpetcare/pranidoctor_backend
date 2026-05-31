import type { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';
import {
  buildUsageLogWhere,
  decimalToNumber,
  hasScopedFilters,
  roundRate,
  roundUsd,
  utcDayStart,
  utcMonthStart,
} from '../usage/ai-usage-analytics.util.js';

export type LogAggregateRow = {
  feature: string | null;
  providerKey: string;
  modelKey: string;
  providerId: string | null;
  modelId: string | null;
  organizationId: string | null;
  branchId: string | null;
  userId: string | null;
  success: boolean;
  isFallback: boolean;
  errorCode: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: { toString(): string } | null;
  billable: boolean;
  latencyMs: number;
  createdAt: Date;
};

const LATENCY_BUCKETS = [
  { label: '0-100ms', maxMs: 100 },
  { label: '100-250ms', maxMs: 250 },
  { label: '250-500ms', maxMs: 500 },
  { label: '500ms-1s', maxMs: 1000 },
  { label: '1-2s', maxMs: 2000 },
  { label: '2-5s', maxMs: 5000 },
  { label: '5-10s', maxMs: 10000 },
  { label: '10s+', maxMs: Number.POSITIVE_INFINITY },
] as const;

export function categorizeErrorCode(errorCode: string | null | undefined): string {
  if (!errorCode?.trim()) return 'UNKNOWN';
  const code = errorCode.trim().toLowerCase();
  if (code.includes('429') || code.includes('rate_limit') || code.includes('rate limit')) {
    return 'RATE_LIMIT';
  }
  if (code === 'timeout' || code.includes('deadline') || code.includes('timed_out')) {
    return 'TIMEOUT';
  }
  if (
    code.includes('401') ||
    code.includes('403') ||
    code.includes('api_key') ||
    code.includes('unauthorized') ||
    code.includes('forbidden')
  ) {
    return 'AUTH';
  }
  if (code.includes('context') || code.includes('token_limit') || code.includes('length')) {
    return 'CONTEXT';
  }
  if (
    code.includes('kill_switch') ||
    code.includes('budget') ||
    code.includes('consent') ||
    code.includes('governance')
  ) {
    return 'GOVERNANCE';
  }
  if (code.includes('400') || code.includes('validation') || code.includes('invalid')) {
    return 'VALIDATION';
  }
  if (code.startsWith('5') || code.includes('upstream') || code.includes('provider')) {
    return 'PROVIDER';
  }
  return 'UNKNOWN';
}

export function shouldPreferRollups(filters: UsageAnalyticsFilters): boolean {
  return !hasScopedFilters(filters);
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

export function buildLatencyHistogram(latencies: number[]): Array<{ bucket: string; count: number }> {
  const counts = new Map<string, number>();
  for (const bucket of LATENCY_BUCKETS) {
    counts.set(bucket.label, 0);
  }
  for (const ms of latencies) {
    const matched =
      LATENCY_BUCKETS.find((b) => ms <= b.maxMs) ?? LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1]!;
    counts.set(matched.label, (counts.get(matched.label) ?? 0) + 1);
  }
  return LATENCY_BUCKETS.map((b) => ({ bucket: b.label, count: counts.get(b.label) ?? 0 }));
}

export async function fetchUsageLogs(
  filters: UsageAnalyticsFilters,
  options?: { exclusiveEnd?: boolean },
): Promise<LogAggregateRow[]> {
  const prisma = getPrisma();
  return prisma.aiUsageLog.findMany({
    where: buildUsageLogWhere(filters, options),
    select: {
      feature: true,
      providerKey: true,
      modelKey: true,
      providerId: true,
      modelId: true,
      organizationId: true,
      branchId: true,
      userId: true,
      success: true,
      isFallback: true,
      errorCode: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      costUsd: true,
      billable: true,
      latencyMs: true,
      createdAt: true,
    },
  });
}

/** Half-open UTC bucket range `[fromInclusive, toExclusive)` for reconciliation jobs. */
export async function fetchUsageLogsForBucket(
  fromInclusive: Date,
  toExclusive: Date,
  scope?: Pick<
    UsageAnalyticsFilters,
    'branchId' | 'organizationId' | 'tenantId' | 'userId' | 'feature' | 'provider' | 'taskType'
  >,
): Promise<LogAggregateRow[]> {
  return fetchUsageLogs(
    {
      from: fromInclusive,
      to: toExclusive,
      ...scope,
    },
    { exclusiveEnd: true },
  );
}

export async function aggregatePlatformTotalsFromRollups(filters: UsageAnalyticsFilters): Promise<{
  requests: number;
  successes: number;
  failures: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  billableCostUsd: number;
  latencyMsSum: number;
}> {
  const prisma = getPrisma();
  const rows = await prisma.aiUsageDailyRollup.findMany({
    where: {
      bucketDate: { gte: utcDayStart(filters.from), lte: utcDayStart(filters.to) },
    },
  });

  let requests = 0;
  let successes = 0;
  let failures = 0;
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let billableCostUsd = 0;
  let latencyMsSum = 0;

  for (const row of rows) {
    requests += row.requestCount;
    successes += row.successCount;
    failures += row.failureCount;
    totalTokens += row.totalTokens;
    inputTokens += row.inputTokens;
    outputTokens += row.outputTokens;
    costUsd += decimalToNumber(row.costUsd);
    billableCostUsd += decimalToNumber(row.billableCostUsd);
    latencyMsSum += row.latencyMsSum;
  }

  return {
    requests,
    successes,
    failures,
    totalTokens,
    inputTokens,
    outputTokens,
    costUsd: roundUsd(costUsd),
    billableCostUsd: roundUsd(billableCostUsd),
    latencyMsSum,
  };
}

export async function aggregatePlatformDailyCostFromRollups(
  filters: UsageAnalyticsFilters,
): Promise<
  Array<{
    date: string;
    costUsd: number;
    billableCostUsd: number;
    requests: number;
    totalTokens: number;
  }>
> {
  const prisma = getPrisma();
  const rows = await prisma.aiUsageDailyRollup.groupBy({
    by: ['bucketDate'],
    where: {
      bucketDate: { gte: utcDayStart(filters.from), lte: utcDayStart(filters.to) },
    },
    _sum: {
      costUsd: true,
      billableCostUsd: true,
      requestCount: true,
      totalTokens: true,
    },
    orderBy: { bucketDate: 'asc' },
  });

  return rows.map((row) => ({
    date: row.bucketDate.toISOString().slice(0, 10),
    costUsd: roundUsd(decimalToNumber(row._sum.costUsd)),
    billableCostUsd: roundUsd(decimalToNumber(row._sum.billableCostUsd)),
    requests: row._sum.requestCount ?? 0,
    totalTokens: row._sum.totalTokens ?? 0,
  }));
}

export async function aggregatePlatformProviderCostFromRollups(
  filters: UsageAnalyticsFilters,
): Promise<
  Array<{
    provider: string;
    costUsd: number;
    requests: number;
    totalTokens: number;
  }>
> {
  const prisma = getPrisma();
  const rows = await prisma.aiUsageDailyRollup.groupBy({
    by: ['provider'],
    where: {
      bucketDate: { gte: utcDayStart(filters.from), lte: utcDayStart(filters.to) },
    },
    _sum: {
      costUsd: true,
      requestCount: true,
      totalTokens: true,
    },
    orderBy: { provider: 'asc' },
  });

  return rows.map((row) => ({
    provider: row.provider,
    costUsd: roundUsd(decimalToNumber(row._sum.costUsd)),
    requests: row._sum.requestCount ?? 0,
    totalTokens: row._sum.totalTokens ?? 0,
  }));
}

export function aggregateMonthlyFromDailyMap(
  byDay: Map<string, { costUsd: number; billableCostUsd: number; requests: number; totalTokens: number }>,
): Array<{ month: string; costUsd: number; requests: number; totalTokens: number }> {
  const byMonth = new Map<string, { costUsd: number; requests: number; totalTokens: number }>();
  for (const [date, stats] of byDay) {
    const month = date.slice(0, 7);
    const existing = byMonth.get(month) ?? { costUsd: 0, requests: 0, totalTokens: 0 };
    existing.costUsd = roundUsd(existing.costUsd + stats.costUsd);
    existing.requests += stats.requests;
    existing.totalTokens += stats.totalTokens;
    byMonth.set(month, existing);
  }
  return [...byMonth.entries()]
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function aggregatePlatformMonthlyFromRollups(
  filters: UsageAnalyticsFilters,
): Promise<Array<{ month: string; costUsd: number; requests: number; totalTokens: number }>> {
  const prisma = getPrisma();
  const rows = await prisma.aiUsageMonthlyRollup.findMany({
    where: {
      bucketMonth: { gte: utcMonthStart(filters.from), lte: utcMonthStart(filters.to) },
      dimensionType: 'platform',
      dimensionId: 'global',
    },
    orderBy: { bucketMonth: 'asc' },
  });

  const byMonth = new Map<string, { costUsd: number; requests: number; totalTokens: number }>();
  for (const row of rows) {
    const month = row.bucketMonth.toISOString().slice(0, 7);
    const existing = byMonth.get(month) ?? { costUsd: 0, requests: 0, totalTokens: 0 };
    existing.requests += row.requestCount;
    existing.totalTokens += row.totalTokens;
    existing.costUsd += decimalToNumber(row.costUsd);
    byMonth.set(month, existing);
  }

  return [...byMonth.entries()]
    .map(([month, stats]) => ({
      month,
      costUsd: roundUsd(stats.costUsd),
      requests: stats.requests,
      totalTokens: stats.totalTokens,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function aggregateLogs(logs: LogAggregateRow[]) {
  const users = new Set<string>();
  const branches = new Set<string>();
  const byFeature = new Map<string, { requests: number; totalTokens: number }>();
  const byProvider = new Map<
    string,
    {
      providerId: string | null;
      requests: number;
      successes: number;
      failures: number;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      costUsd: number;
      latencyMsSum: number;
      fallbackCount: number;
    }
  >();
  const byModel = new Map<
    string,
    {
      modelId: string | null;
      provider: string;
      requests: number;
      successes: number;
      totalTokens: number;
      costUsd: number;
      latencyMsSum: number;
    }
  >();
  const byDay = new Map<
    string,
    { costUsd: number; billableCostUsd: number; requests: number; totalTokens: number }
  >();
  const errorCategories = new Map<string, number>();
  const errorCodes = new Map<string, number>();
  const latencies: number[] = [];

  let requests = 0;
  let successes = 0;
  let failures = 0;
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let billableCostUsd = 0;
  let fallbackCount = 0;
  let timeoutCount = 0;

  for (const row of logs) {
    requests += 1;
    if (row.success) successes += 1;
    else failures += 1;
    totalTokens += row.totalTokens;
    inputTokens += row.inputTokens;
    outputTokens += row.outputTokens;
    const rowCost = decimalToNumber(row.costUsd);
    costUsd += rowCost;
    if (row.billable) billableCostUsd += rowCost;
    if (row.isFallback) fallbackCount += 1;
    if (row.errorCode === 'timeout') timeoutCount += 1;
    latencies.push(row.latencyMs);

    if (row.userId) users.add(row.userId);
    if (row.branchId) branches.add(row.branchId);

    const feature = row.feature ?? 'UNKNOWN';
    const featureStats = byFeature.get(feature) ?? { requests: 0, totalTokens: 0 };
    featureStats.requests += 1;
    featureStats.totalTokens += row.totalTokens;
    byFeature.set(feature, featureStats);

    const providerStats = byProvider.get(row.providerKey) ?? {
      providerId: row.providerId,
      requests: 0,
      successes: 0,
      failures: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMsSum: 0,
      fallbackCount: 0,
    };
    providerStats.requests += 1;
    if (row.success) providerStats.successes += 1;
    else providerStats.failures += 1;
    providerStats.inputTokens += row.inputTokens;
    providerStats.outputTokens += row.outputTokens;
    providerStats.totalTokens += row.totalTokens;
    providerStats.costUsd += rowCost;
    providerStats.latencyMsSum += row.latencyMs;
    if (row.isFallback) providerStats.fallbackCount += 1;
    if (!providerStats.providerId && row.providerId) providerStats.providerId = row.providerId;
    byProvider.set(row.providerKey, providerStats);

    const modelKey = `${row.providerKey}:${row.modelKey}`;
    const modelStats = byModel.get(modelKey) ?? {
      modelId: row.modelId,
      provider: row.providerKey,
      requests: 0,
      successes: 0,
      totalTokens: 0,
      costUsd: 0,
      latencyMsSum: 0,
    };
    modelStats.requests += 1;
    if (row.success) modelStats.successes += 1;
    modelStats.totalTokens += row.totalTokens;
    modelStats.costUsd += rowCost;
    modelStats.latencyMsSum += row.latencyMs;
    if (!modelStats.modelId && row.modelId) modelStats.modelId = row.modelId;
    byModel.set(modelKey, modelStats);

    const date = row.createdAt.toISOString().slice(0, 10);
    const dayStats = byDay.get(date) ?? { costUsd: 0, billableCostUsd: 0, requests: 0, totalTokens: 0 };
    dayStats.requests += 1;
    dayStats.totalTokens += row.totalTokens;
    dayStats.costUsd += rowCost;
    if (row.billable) dayStats.billableCostUsd += rowCost;
    byDay.set(date, dayStats);

    if (!row.success) {
      const category = categorizeErrorCode(row.errorCode);
      errorCategories.set(category, (errorCategories.get(category) ?? 0) + 1);
      const code = row.errorCode ?? 'unknown';
      errorCodes.set(code, (errorCodes.get(code) ?? 0) + 1);
    }
  }

  latencies.sort((a, b) => a - b);

  return {
    requests,
    successes,
    failures,
    totalTokens,
    inputTokens,
    outputTokens,
    costUsd: roundUsd(costUsd),
    billableCostUsd: roundUsd(billableCostUsd),
    fallbackCount,
    timeoutCount,
    uniqueUsers: users.size,
    uniqueBranches: branches.size,
    byFeature,
    byProvider,
    byModel,
    byDay,
    errorCategories,
    errorCodes,
    latencies,
    avgLatencyMs: requests > 0 ? Math.round(latencies.reduce((s, v) => s + v, 0) / requests) : 0,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    successRate: roundRate(successes, requests),
  };
}

export function sharePct(value: number, total: number): number {
  return roundRate(value, total);
}

export type DailyRollupUpsert = {
  bucketDate: Date;
  feature: string;
  provider: string;
  model: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billableTokens: number;
  costUsd: number;
  billableCostUsd: number;
  latencyMsSum: number;
};

export type MonthlyRollupUpsert = {
  bucketMonth: Date;
  dimensionType: string;
  dimensionId: string;
  provider: string;
  model: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMsSum: number;
  timeoutCount: number;
};

export function buildDailyRollupBuckets(logs: LogAggregateRow[], bucketDate: Date): DailyRollupUpsert[] {
  const map = new Map<string, DailyRollupUpsert>();

  for (const row of logs) {
    const feature = row.feature ?? 'UNKNOWN';
    const key = `${feature}|${row.providerKey}|${row.modelKey}`;
    const existing = map.get(key) ?? {
      bucketDate,
      feature,
      provider: row.providerKey,
      model: row.modelKey,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      billableTokens: 0,
      costUsd: 0,
      billableCostUsd: 0,
      latencyMsSum: 0,
    };

    const rowCost = decimalToNumber(row.costUsd);
    existing.requestCount += 1;
    if (row.success) existing.successCount += 1;
    else existing.failureCount += 1;
    existing.inputTokens += row.inputTokens;
    existing.outputTokens += row.outputTokens;
    existing.totalTokens += row.totalTokens;
    if (row.billable) existing.billableTokens += row.totalTokens;
    existing.costUsd = roundUsd(existing.costUsd + rowCost);
    if (row.billable) existing.billableCostUsd = roundUsd(existing.billableCostUsd + rowCost);
    existing.latencyMsSum += row.latencyMs;
    map.set(key, existing);
  }

  return [...map.values()];
}

export function buildMonthlyRollupBuckets(
  logs: LogAggregateRow[],
  bucketMonth: Date,
): MonthlyRollupUpsert[] {
  const map = new Map<string, MonthlyRollupUpsert>();

  for (const row of logs) {
    const dimensions: Array<{ dimensionType: string; dimensionId: string }> = [
      { dimensionType: 'platform', dimensionId: 'global' },
    ];
    if (row.organizationId) {
      dimensions.push({ dimensionType: 'organization', dimensionId: row.organizationId });
    }
    if (row.branchId) {
      dimensions.push({ dimensionType: 'branch', dimensionId: row.branchId });
    }

    const rowCost = decimalToNumber(row.costUsd);
    const isTimeout = row.errorCode === 'timeout';

    for (const dim of dimensions) {
      const key = `${dim.dimensionType}|${dim.dimensionId}|${row.providerKey}|${row.modelKey}`;
      const existing = map.get(key) ?? {
        bucketMonth,
        dimensionType: dim.dimensionType,
        dimensionId: dim.dimensionId,
        provider: row.providerKey,
        model: row.modelKey,
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        latencyMsSum: 0,
        timeoutCount: 0,
      };

      existing.requestCount += 1;
      if (row.success) existing.successCount += 1;
      else existing.failureCount += 1;
      existing.inputTokens += row.inputTokens;
      existing.outputTokens += row.outputTokens;
      existing.totalTokens += row.totalTokens;
      existing.costUsd = roundUsd(existing.costUsd + rowCost);
      existing.latencyMsSum += row.latencyMs;
      if (isTimeout) existing.timeoutCount += 1;
      map.set(key, existing);
    }
  }

  return [...map.values()];
}

export async function upsertDailyRollups(buckets: DailyRollupUpsert[]): Promise<number> {
  const prisma = getPrisma();
  let count = 0;
  for (const bucket of buckets) {
    await prisma.aiUsageDailyRollup.upsert({
      where: {
        bucketDate_feature_provider_model: {
          bucketDate: bucket.bucketDate,
          feature: bucket.feature,
          provider: bucket.provider,
          model: bucket.model,
        },
      },
      create: bucket,
      update: {
        requestCount: bucket.requestCount,
        successCount: bucket.successCount,
        failureCount: bucket.failureCount,
        inputTokens: bucket.inputTokens,
        outputTokens: bucket.outputTokens,
        totalTokens: bucket.totalTokens,
        billableTokens: bucket.billableTokens,
        costUsd: bucket.costUsd,
        billableCostUsd: bucket.billableCostUsd,
        latencyMsSum: bucket.latencyMsSum,
      },
    });
    count += 1;
  }
  return count;
}

export async function upsertMonthlyRollups(buckets: MonthlyRollupUpsert[]): Promise<number> {
  const prisma = getPrisma();
  let count = 0;
  for (const bucket of buckets) {
    await prisma.aiUsageMonthlyRollup.upsert({
      where: {
        bucketMonth_dimensionType_dimensionId_provider_model: {
          bucketMonth: bucket.bucketMonth,
          dimensionType: bucket.dimensionType,
          dimensionId: bucket.dimensionId,
          provider: bucket.provider,
          model: bucket.model,
        },
      },
      create: bucket as Prisma.AiUsageMonthlyRollupCreateInput,
      update: {
        requestCount: bucket.requestCount,
        successCount: bucket.successCount,
        failureCount: bucket.failureCount,
        inputTokens: bucket.inputTokens,
        outputTokens: bucket.outputTokens,
        totalTokens: bucket.totalTokens,
        costUsd: bucket.costUsd,
        latencyMsSum: bucket.latencyMsSum,
        timeoutCount: bucket.timeoutCount,
      },
    });
    count += 1;
  }
  return count;
}
