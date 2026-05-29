import type {
  FeedType,
  FeedUnit,
  InventoryTransactionSourceType,
  InventoryTransactionType,
  InventoryType,
  MedicineUnit,
} from '@/generated/prisma/client';

export type InventoryItemDto = {
  id: string;
  customerId: string;
  farmRef: string;
  inventoryType: InventoryType;
  displayName: string;
  feedCatalogId: string | null;
  feedType: FeedType | null;
  feedUnit: FeedUnit | null;
  medicineUnit: MedicineUnit | null;
  lowStockThreshold: number | null;
  allowNegativeStock: boolean;
  isActive: boolean;
  deletedAt: string | null;
  notes: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryTransactionDto = {
  id: string;
  inventoryItemId: string;
  farmRef: string;
  inventoryType: InventoryType;
  transactionType: InventoryTransactionType;
  quantityDelta: number;
  unitSnapshot: string;
  sourceType: InventoryTransactionSourceType;
  sourceId: string | null;
  reason: string | null;
  recordedAt: string;
  createdAt: string;
};

export type InventorySummaryDto = {
  farmRef: string;
  feed: { activeItems: number; lowStockCount: number };
  medicine: { activeItems: number; lowStockCount: number };
};

export type LowStockAlertDto = {
  inventoryItemId: string;
  displayName: string;
  inventoryType: InventoryType;
  quantityOnHand: number;
  quantityAvailable: number;
  lowStockThreshold: number;
  suggestedAction: 'PURCHASE' | 'RESTOCK';
  message: string;
};

export type InventoryListResponseDto = {
  items: InventoryItemDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  lowStockAlerts: LowStockAlertDto[];
};

export type AddStockResultDto = {
  item: InventoryItemDto;
  transaction: InventoryTransactionDto;
};

export type AddStockBatchResultDto = {
  items: InventoryItemDto[];
  count: number;
};

export type ConsumeStockResultDto = {
  item: InventoryItemDto;
  transaction: InventoryTransactionDto;
};
