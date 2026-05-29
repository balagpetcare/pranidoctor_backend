import type { Prisma } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import type { DashboardDto, FeedAnalyticsCacheDto } from './feed-analytics.dto.js';

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toFeedAnalyticsCacheDto(
  row: {
    id: string;
    customerId: string;
    farmRef: string;
    cacheKey: string;
    periodStart: Date;
    periodEnd: Date;
    metricsJson: Prisma.JsonValue;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
): FeedAnalyticsCacheDto {
  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    cacheKey: row.cacheKey,
    periodStart: formatDate(row.periodStart),
    periodEnd: formatDate(row.periodEnd),
    metrics: row.metricsJson as DashboardDto,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function sumDecimal(values: Array<Prisma.Decimal | null | undefined>): number {
  return values.reduce((acc, value) => acc + (decimalToNumber(value) ?? 0), 0);
}
