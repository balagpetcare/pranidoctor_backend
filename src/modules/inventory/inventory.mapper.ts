import { Prisma } from '@/generated/prisma/client';
import type { InventoryType } from '@/generated/prisma/client';

import type {
  InventoryItemDto,
  InventoryTransactionDto,
  LowStockAlertDto,
} from './inventory.dto.js';
import type { InventoryItemRow } from './inventory.repository.js';

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export function toInventoryItemDto(row: InventoryItemRow): InventoryItemDto {
  const onHand = decimalToNumber(row.balance?.quantityOnHand);
  const reserved = decimalToNumber(row.balance?.quantityReserved);
  const available = Math.round((onHand - reserved) * 1000) / 1000;
  const threshold =
    row.lowStockThreshold != null ? decimalToNumber(row.lowStockThreshold) : null;

  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    inventoryType: row.inventoryType,
    displayName: row.displayName,
    feedCatalogId: row.feedCatalogId ?? null,
    feedType: row.feedType,
    feedUnit: row.feedUnit,
    medicineUnit: row.medicineUnit,
    lowStockThreshold: threshold,
    allowNegativeStock: row.allowNegativeStock,
    isActive: row.isActive,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    notes: row.notes,
    quantityOnHand: onHand,
    quantityReserved: reserved,
    quantityAvailable: available,
    isLowStock: threshold != null && onHand <= threshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInventoryTransactionDto(row: {
  id: string;
  inventoryItemId: string;
  farmRef: string;
  inventoryType: InventoryType;
  transactionType: string;
  quantityDelta: Prisma.Decimal;
  unitSnapshot: string;
  sourceType: string;
  sourceId: string | null;
  reason: string | null;
  recordedAt: Date;
  createdAt: Date;
}): InventoryTransactionDto {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    farmRef: row.farmRef,
    inventoryType: row.inventoryType,
    transactionType: row.transactionType as InventoryTransactionDto['transactionType'],
    quantityDelta: decimalToNumber(row.quantityDelta),
    unitSnapshot: row.unitSnapshot,
    sourceType: row.sourceType as InventoryTransactionDto['sourceType'],
    sourceId: row.sourceId,
    reason: row.reason,
    recordedAt: row.recordedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLowStockAlertDto(item: InventoryItemDto): LowStockAlertDto | null {
  if (!item.isLowStock || item.lowStockThreshold == null) return null;
  const suggestedAction = item.inventoryType === 'FEED' ? 'PURCHASE' : 'RESTOCK';
  return {
    inventoryItemId: item.id,
    displayName: item.displayName,
    inventoryType: item.inventoryType,
    quantityOnHand: item.quantityOnHand,
    quantityAvailable: item.quantityAvailable,
    lowStockThreshold: item.lowStockThreshold,
    suggestedAction,
    message:
      item.inventoryType === 'FEED'
        ? 'Stock is below your alert level. Consider buying more feed.'
        : 'Medicine stock is low. Consider restocking.',
  };
}
