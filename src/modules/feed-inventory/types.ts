import type { FeedUnit, Prisma } from '@/generated/prisma/client';

export type FeedInventoryRow = {
  id: string;
  customerId: string;
  farmRef: string;
  deploymentBranch: string | null;
  feedItemId: string | null;
  displayName: string;
  unit: FeedUnit;
  quantityOnHand: Prisma.Decimal;
  lowStockThreshold: Prisma.Decimal | null;
  defaultBagWeightKg: Prisma.Decimal | null;
  allowNegativeStock: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  feedItem?: {
    id: string;
    code: string;
    nameBn: string;
    nameEn: string;
    category: string;
    defaultUnit: FeedUnit;
  } | null;
};

export type FeedPurchaseRow = {
  id: string;
  customerId: string;
  farmRef: string;
  feedInventoryId: string;
  feedItemId: string | null;
  quantity: Prisma.Decimal;
  unit: FeedUnit;
  unitCostBdt: Prisma.Decimal | null;
  totalCostBdt: Prisma.Decimal | null;
  supplierName: string | null;
  supplierPhone: string | null;
  purchasedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListFeedInventoryQuery = {
  farmRef: string;
  search?: string;
  page: number;
  limit: number;
};

export type CreateFeedInventoryInput = {
  farmRef: string;
  deploymentBranch?: string | null;
  feedItemId?: string | null;
  displayName: string;
  unit?: FeedUnit;
  quantityOnHand?: number;
  lowStockThreshold?: number | null;
  defaultBagWeightKg?: number | null;
  allowNegativeStock?: boolean;
  notes?: string | null;
};

export type UpdateFeedInventoryInput = {
  deploymentBranch?: string | null;
  feedItemId?: string | null;
  displayName?: string;
  unit?: FeedUnit;
  lowStockThreshold?: number | null;
  defaultBagWeightKg?: number | null;
  allowNegativeStock?: boolean;
  isActive?: boolean;
  notes?: string | null;
};

export type RecordFeedPurchaseInput = {
  farmRef: string;
  feedInventoryId: string;
  feedItemId?: string | null;
  quantity: number;
  unit: FeedUnit;
  unitCostBdt?: number | null;
  totalCostBdt?: number | null;
  supplierName?: string | null;
  supplierPhone?: string | null;
  purchasedAt: Date;
  notes?: string | null;
};

export type PaginatedFeedInventory = {
  items: FeedInventoryRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type RecordFeedPurchaseResult = {
  purchase: FeedPurchaseRow;
  inventory: FeedInventoryRow;
};

export type FeedInventoryLowStockAlert = {
  feedInventoryId: string;
  displayName: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  unit: FeedUnit;
  suggestedAction: 'PURCHASE' | 'RESTOCK';
  message: string;
};
