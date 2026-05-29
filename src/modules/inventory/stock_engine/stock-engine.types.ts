import type {
  InventoryTransactionSourceType,
  InventoryTransactionType,
  InventoryType,
} from '@/generated/prisma/client';

export type StockOperationInput = {
  customerId: string;
  inventoryItemId: string;
  farmRef: string;
  inventoryType: InventoryType;
  transactionType: InventoryTransactionType;
  quantity: number;
  unitSnapshot: string;
  sourceType: InventoryTransactionSourceType;
  sourceId?: string;
  idempotencyKey?: string;
  reason?: string;
  authorizedBy?: string;
  actorUserId?: string;
  useReserved?: boolean;
};

export type StockOperationResult = {
  transactionId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  isLowStock: boolean;
};

export class InventoryStockError extends Error {
  constructor(
    readonly code:
      | 'ITEM_NOT_FOUND'
      | 'ITEM_INACTIVE'
      | 'ITEM_TYPE_MISMATCH'
      | 'FARM_MISMATCH'
      | 'INSUFFICIENT_STOCK'
      | 'INSUFFICIENT_RESERVED'
      | 'INVALID_QUANTITY'
      | 'DUPLICATE_IDEMPOTENCY',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'InventoryStockError';
  }
}
