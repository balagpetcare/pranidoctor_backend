import { Prisma, type FeedConsumption, type FeedUnit } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';

export type FeedConsumptionDto = {
  id: string;
  customerId: string;
  farmRef: string;
  livestockId: string | null;
  feedInventoryId: string | null;
  feedItemId: string | null;
  amount: number;
  unit: FeedUnit;
  costBdt: number | null;
  deductStock: boolean;
  recordedDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedConsumptionListResponseDto = {
  items: FeedConsumptionDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toFeedConsumptionDto(row: FeedConsumption): FeedConsumptionDto {
  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    livestockId: row.livestockId,
    feedInventoryId: row.feedInventoryId,
    feedItemId: row.feedItemId,
    amount: decimalToNumber(row.amount) ?? 0,
    unit: row.unit,
    costBdt: decimalToNumber(row.costBdt),
    deductStock: row.deductStock,
    recordedDate: formatDateOnly(row.recordedDate),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toDecimalInput(
  value: number | null | undefined,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value.toFixed(3));
}
