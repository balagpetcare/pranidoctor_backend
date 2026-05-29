import { z } from 'zod';

import { FeedUnit } from '@/generated/prisma/client';

import {
  FEED_CONSUMPTION_DEFAULT_LIMIT,
  FEED_CONSUMPTION_DEFAULT_PAGE,
  FEED_CONSUMPTION_MAX_LIMIT,
} from './feed-consumption.constants.js';

const farmRefSchema = z.string().trim().min(1).max(200);
const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const feedConsumptionListQuerySchema = z.object({
  farmRef: farmRefSchema,
  livestockId: z.string().trim().min(1).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(FEED_CONSUMPTION_DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEED_CONSUMPTION_MAX_LIMIT)
    .default(FEED_CONSUMPTION_DEFAULT_LIMIT),
});

export const createFeedConsumptionBodySchema = z
  .object({
    farmRef: farmRefSchema,
    livestockId: z.string().trim().min(1).optional(),
    feedInventoryId: z.string().trim().min(1).optional(),
    feedItemId: z.string().trim().min(1).optional(),
    amount: z.coerce.number().positive().max(999999),
    unit: z.nativeEnum(FeedUnit),
    costBdt: z.coerce.number().min(0).max(999999999).optional(),
    deductStock: z.boolean().optional().default(false),
    recordedDate: dateStringSchema,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.deductStock && !data.feedInventoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'feedInventoryId is required when deductStock is true',
        path: ['feedInventoryId'],
      });
    }
  });

export const updateFeedConsumptionBodySchema = z
  .object({
    farmRef: farmRefSchema.optional(),
    livestockId: z.union([z.string().trim().min(1), z.null()]).optional(),
    feedInventoryId: z.union([z.string().trim().min(1), z.null()]).optional(),
    feedItemId: z.union([z.string().trim().min(1), z.null()]).optional(),
    amount: z.coerce.number().positive().max(999999).optional(),
    unit: z.nativeEnum(FeedUnit).optional(),
    costBdt: z.union([z.coerce.number().min(0).max(999999999), z.null()]).optional(),
    deductStock: z.boolean().optional(),
    recordedDate: dateStringSchema.optional(),
    notes: z.union([z.string().trim().max(2000), z.null()]).optional(),
  })
  .strict();

export type FeedConsumptionListQueryInput = z.infer<typeof feedConsumptionListQuerySchema>;
export type CreateFeedConsumptionBody = z.infer<typeof createFeedConsumptionBodySchema>;
export type UpdateFeedConsumptionBody = z.infer<typeof updateFeedConsumptionBodySchema>;
