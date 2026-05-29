import { FeedUnit } from '@/generated/prisma/client';
import { z } from 'zod';

import {
  FEED_INVENTORY_DEFAULT_LIMIT,
  FEED_INVENTORY_DEFAULT_PAGE,
  FEED_INVENTORY_MAX_LIMIT,
} from './constants.js';

const farmRefSchema = z.string().trim().min(1).max(200);

export const listFeedInventoryQuerySchema = z.object({
  farmRef: farmRefSchema,
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(FEED_INVENTORY_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(FEED_INVENTORY_MAX_LIMIT).default(FEED_INVENTORY_DEFAULT_LIMIT),
});

export const createFeedInventoryBodySchema = z
  .object({
    farmRef: farmRefSchema,
    deploymentBranch: z.string().trim().max(120).nullable().optional(),
    feedItemId: z.string().trim().min(1).nullable().optional(),
    displayName: z.string().trim().min(1).max(120),
    unit: z.nativeEnum(FeedUnit).optional(),
    quantityOnHand: z.coerce.number().min(0).max(999999).optional(),
    lowStockThreshold: z.coerce.number().min(0).max(999999).nullable().optional(),
    defaultBagWeightKg: z.coerce.number().min(0).max(999999).nullable().optional(),
    allowNegativeStock: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const updateFeedInventoryBodySchema = z
  .object({
    deploymentBranch: z.string().trim().max(120).nullable().optional(),
    feedItemId: z.string().trim().min(1).nullable().optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    unit: z.nativeEnum(FeedUnit).optional(),
    lowStockThreshold: z.coerce.number().min(0).max(999999).nullable().optional(),
    defaultBagWeightKg: z.coerce.number().min(0).max(999999).nullable().optional(),
    allowNegativeStock: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const recordFeedPurchaseBodySchema = z
  .object({
    farmRef: farmRefSchema,
    feedInventoryId: z.string().trim().min(1),
    feedItemId: z.string().trim().min(1).nullable().optional(),
    quantity: z.coerce.number().positive().max(999999),
    unit: z.nativeEnum(FeedUnit),
    unitCostBdt: z.coerce.number().min(0).max(999999).nullable().optional(),
    totalCostBdt: z.coerce.number().min(0).max(999999).nullable().optional(),
    supplierName: z.string().trim().max(200).nullable().optional(),
    supplierPhone: z.string().trim().max(30).nullable().optional(),
    purchasedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'purchasedAt must be YYYY-MM-DD'),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const feedInventoryLowStockQuerySchema = z.object({
  farmRef: farmRefSchema,
});

export type ListFeedInventoryQueryInput = z.infer<typeof listFeedInventoryQuerySchema>;
export type CreateFeedInventoryBodyInput = z.infer<typeof createFeedInventoryBodySchema>;
export type UpdateFeedInventoryBodyInput = z.infer<typeof updateFeedInventoryBodySchema>;
export type RecordFeedPurchaseBodyInput = z.infer<typeof recordFeedPurchaseBodySchema>;
export type FeedInventoryLowStockQueryInput = z.infer<typeof feedInventoryLowStockQuerySchema>;
