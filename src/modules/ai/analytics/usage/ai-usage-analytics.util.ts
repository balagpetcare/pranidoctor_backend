import type { Prisma } from '../../../../generated/prisma/index.js';
import type { UsageAnalyticsFilters } from './ai-usage-analytics.types.js';

export function decimalToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function roundRate(successes: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((successes / total) * 10000) / 100;
}

export function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function parseAnalyticsDateRange(query: {
  from?: string;
  to?: string;
  sinceDays?: number;
}): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  if (Number.isNaN(to.getTime())) {
    throw new Error('Invalid "to" date');
  }

  if (query.from) {
    const from = new Date(query.from);
    if (Number.isNaN(from.getTime())) throw new Error('Invalid "from" date');
    return { from, to };
  }

  const sinceDays = Math.min(365, Math.max(1, query.sinceDays ?? 30));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - sinceDays);
  return { from, to };
}

export function hasScopedFilters(filters: UsageAnalyticsFilters): boolean {
  return Boolean(
    filters.branchId ||
      filters.organizationId ||
      filters.userId ||
      filters.feature ||
      filters.provider ||
      filters.taskType,
  );
}

export function buildUsageRecordWhere(filters: UsageAnalyticsFilters): Prisma.AiUsageRecordWhereInput {
  const where: Prisma.AiUsageRecordWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.feature) where.feature = filters.feature;
  if (filters.provider) where.provider = filters.provider;
  return where;
}

export function buildUsageLogWhere(filters: UsageAnalyticsFilters): Prisma.AiUsageLogWhereInput {
  const where: Prisma.AiUsageLogWhereInput = {
    createdAt: { gte: filters.from, lte: filters.to },
  };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.feature) where.feature = filters.feature;
  if (filters.provider) where.providerKey = filters.provider;
  if (filters.taskType) where.taskType = filters.taskType;
  if (filters.tenantId) where.tenantId = filters.tenantId;
  return where;
}

export function sharePct(value: number, total: number): number {
  if (total <= 0) return 0;
  return roundRate(value, total);
}
