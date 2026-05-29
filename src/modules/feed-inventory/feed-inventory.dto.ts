import type { FeedUnit } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import type {
  FeedInventoryLowStockAlert,
  FeedInventoryRow,
  FeedPurchaseRow,
} from './types.js';

export type FeedInventoryItemDto = {
  id: string;
  customerId: string;
  farmRef: string;
  deploymentBranch: string | null;
  feedItemId: string | null;
  displayName: string;
  unit: FeedUnit;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  defaultBagWeightKg: number | null;
  allowNegativeStock: boolean;
  isActive: boolean;
  isLowStock: boolean;
  notes: string | null;
  feedItem: {
    id: string;
    code: string;
    nameBn: string;
    nameEn: string;
    category: string;
    defaultUnit: FeedUnit;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedPurchaseDto = {
  id: string;
  customerId: string;
  farmRef: string;
  feedInventoryId: string;
  feedItemId: string | null;
  quantity: number;
  unit: FeedUnit;
  unitCostBdt: number | null;
  totalCostBdt: number | null;
  supplierName: string | null;
  supplierPhone: string | null;
  purchasedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedInventoryListResponseDto = {
  items: FeedInventoryItemDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type RecordFeedPurchaseResponseDto = {
  purchase: FeedPurchaseDto;
  inventory: FeedInventoryItemDto;
};

export type FeedInventoryLowStockAlertDto = FeedInventoryLowStockAlert;

function isLowStock(row: FeedInventoryRow): boolean {
  const threshold = decimalToNumber(row.lowStockThreshold);
  if (threshold == null) return false;
  const onHand = decimalToNumber(row.quantityOnHand) ?? 0;
  return onHand <= threshold;
}

export function toFeedInventoryItemDto(row: FeedInventoryRow): FeedInventoryItemDto {
  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    deploymentBranch: row.deploymentBranch,
    feedItemId: row.feedItemId,
    displayName: row.displayName,
    unit: row.unit,
    quantityOnHand: decimalToNumber(row.quantityOnHand) ?? 0,
    lowStockThreshold: decimalToNumber(row.lowStockThreshold),
    defaultBagWeightKg: decimalToNumber(row.defaultBagWeightKg),
    allowNegativeStock: row.allowNegativeStock,
    isActive: row.isActive,
    isLowStock: isLowStock(row),
    notes: row.notes,
    feedItem: row.feedItem
      ? {
          id: row.feedItem.id,
          code: row.feedItem.code,
          nameBn: row.feedItem.nameBn,
          nameEn: row.feedItem.nameEn,
          category: row.feedItem.category,
          defaultUnit: row.feedItem.defaultUnit,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFeedPurchaseDto(row: FeedPurchaseRow): FeedPurchaseDto {
  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    feedInventoryId: row.feedInventoryId,
    feedItemId: row.feedItemId,
    quantity: decimalToNumber(row.quantity) ?? 0,
    unit: row.unit,
    unitCostBdt: decimalToNumber(row.unitCostBdt),
    totalCostBdt: decimalToNumber(row.totalCostBdt),
    supplierName: row.supplierName,
    supplierPhone: row.supplierPhone,
    purchasedAt: row.purchasedAt.toISOString().slice(0, 10),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFeedInventoryListResponseDto(result: {
  items: FeedInventoryRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}): FeedInventoryListResponseDto {
  return {
    items: result.items.map(toFeedInventoryItemDto),
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  };
}

export function toLowStockAlertDto(row: FeedInventoryRow): FeedInventoryLowStockAlertDto | null {
  const threshold = decimalToNumber(row.lowStockThreshold);
  const onHand = decimalToNumber(row.quantityOnHand) ?? 0;
  if (threshold == null || onHand > threshold) return null;

  return {
    feedInventoryId: row.id,
    displayName: row.displayName,
    quantityOnHand: onHand,
    lowStockThreshold: threshold,
    unit: row.unit,
    suggestedAction: onHand <= 0 ? 'PURCHASE' : 'RESTOCK',
    message:
      onHand <= 0
        ? `${row.displayName} is out of stock`
        : `${row.displayName} is below the low-stock threshold`,
  };
}
