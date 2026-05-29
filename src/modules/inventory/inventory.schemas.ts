import { z } from 'zod';

import {
  FeedType,
  FeedUnit,
  InventoryTransactionSourceType,
  InventoryType,
  MedicineUnit,
} from '@/generated/prisma/client';

const farmRefSchema = z.string().trim().min(1).max(200);

export const inventoryListQuerySchema = z.object({
  farmRef: farmRefSchema,
  search: z.string().trim().max(120).optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const inventorySummaryQuerySchema = z.object({
  farmRef: farmRefSchema,
});

const addOperationSchema = z.enum([
  'CREATE_ITEM',
  'RECEIPT',
  'ADJUSTMENT',
  'SET_THRESHOLD',
  'RESERVE',
  'RELEASE_RESERVE',
]);

/** Batch create feed stock from catalog — feedId = FeedCatalog.id */
export const feedCatalogBatchItemSchema = z.object({
  feedId: z.string().trim().min(1),
  openingQuantity: z
    .union([z.coerce.number().min(0).max(999999), z.null()])
    .optional(),
  lowStockLevel: z
    .union([z.coerce.number().min(0).max(999999), z.null()])
    .optional(),
});

export const addInventoryBodySchema = z
  .object({
    farmRef: farmRefSchema,
    inventoryType: z.nativeEnum(InventoryType),
    operation: addOperationSchema.default('RECEIPT'),
    inventoryItemId: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    feedCatalogId: z.string().trim().min(1).optional(),
    feedType: z.nativeEnum(FeedType).optional(),
    feedUnit: z.nativeEnum(FeedUnit).optional(),
    medicineUnit: z.nativeEnum(MedicineUnit).optional(),
    quantity: z.coerce.number().optional(),
    lowStockThreshold: z.coerce.number().min(0).max(999999).nullable().optional(),
    allowNegativeStock: z.boolean().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(64).optional(),
    items: z.array(feedCatalogBatchItemSchema).min(1).max(50).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.operation === 'CREATE_ITEM') {
      const hasBatch = (data.items?.length ?? 0) > 0;
      if (hasBatch) {
        if (data.inventoryType !== 'FEED') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'items batch is only supported for FEED inventory',
            path: ['items'],
          });
        }
        return;
      }
      if (!data.displayName && !data.feedCatalogId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'displayName or feedCatalogId is required for CREATE_ITEM',
          path: ['displayName'],
        });
      }
      if (data.inventoryType === 'FEED' && !data.feedUnit && !data.feedCatalogId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'feedUnit is required for custom feed items',
          path: ['feedUnit'],
        });
      }
      if (data.inventoryType === 'MEDICINE' && !data.medicineUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'medicineUnit is required for medicine items',
          path: ['medicineUnit'],
        });
      }
      return;
    }
    if (!data.inventoryItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'inventoryItemId is required for this operation',
        path: ['inventoryItemId'],
      });
    }
    if (
      ['RECEIPT', 'ADJUSTMENT', 'RESERVE', 'RELEASE_RESERVE'].includes(data.operation) &&
      (data.quantity === undefined || Number.isNaN(data.quantity))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'quantity is required for stock operations',
        path: ['quantity'],
      });
    }
    if (data.operation === 'RESERVE' && data.inventoryType !== 'MEDICINE') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RESERVE is only supported for MEDICINE inventory',
        path: ['operation'],
      });
    }
  });

export const consumeInventoryBodySchema = z
  .object({
    farmRef: farmRefSchema,
    inventoryType: z.nativeEnum(InventoryType),
    inventoryItemId: z.string().trim().min(1),
    quantity: z.coerce.number().positive().max(999999),
    sourceType: z.nativeEnum(InventoryTransactionSourceType),
    sourceId: z.string().trim().min(1).optional(),
    reason: z.string().trim().max(2000).optional(),
    authorizedBy: z.string().trim().max(200).optional(),
    useReserved: z.boolean().optional(),
    idempotencyKey: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.inventoryType === 'FEED' && data.sourceType !== 'FEED_RECORD') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Feed consumption must use sourceType FEED_RECORD',
        path: ['sourceType'],
      });
    }
    if (
      data.inventoryType === 'MEDICINE' &&
      !['FARM_TREATMENT', 'PRESCRIPTION_ITEM', 'TREATMENT_CASE', 'AI_PLAN'].includes(
        data.sourceType,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Medicine consumption requires a clinical source type',
        path: ['sourceType'],
      });
    }
    if (data.sourceType !== 'MANUAL' && !data.sourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sourceId is required for linked consumption',
        path: ['sourceId'],
      });
    }
  });

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type InventorySummaryQuery = z.infer<typeof inventorySummaryQuerySchema>;
export type AddInventoryBody = z.infer<typeof addInventoryBodySchema>;
export type ConsumeInventoryBody = z.infer<typeof consumeInventoryBodySchema>;
