import type { FeedUnit } from '@/generated/prisma/client';

export type FeedConsumptionErrorCode =
  | 'NOT_FOUND'
  | 'INSUFFICIENT_STOCK'
  | 'DUPLICATE_IDEMPOTENCY'
  | 'VALIDATION_ERROR';

export type FeedConsumptionListQuery = {
  farmRef: string;
  livestockId?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
};

export type CreateFeedConsumptionInput = {
  farmRef: string;
  livestockId?: string;
  feedInventoryId?: string;
  feedItemId?: string;
  amount: number;
  unit: FeedUnit;
  costBdt?: number;
  deductStock?: boolean;
  recordedDate: Date | string;
  notes?: string;
};

export type UpdateFeedConsumptionInput = {
  farmRef?: string;
  livestockId?: string | null;
  feedInventoryId?: string | null;
  feedItemId?: string | null;
  amount?: number;
  unit?: FeedUnit;
  costBdt?: number | null;
  deductStock?: boolean;
  recordedDate?: Date | string;
  notes?: string | null;
};
