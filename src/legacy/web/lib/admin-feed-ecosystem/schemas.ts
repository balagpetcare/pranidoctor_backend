import { FeedCategory } from '@/generated/prisma/client';
import { z } from 'zod';

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const patchCategoryMetaSchema = z.record(
  z.nativeEnum(FeedCategory),
  z
    .object({
      labelBn: z.string().trim().max(120).optional(),
      labelEn: z.string().trim().max(120).optional(),
      descriptionBn: z.string().trim().max(500).optional(),
    })
    .strict(),
);

export const inventoryMonitorQuerySchema = adminPaginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  lowStockOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
  farmRef: z.string().trim().max(120).optional(),
});

export const nutritionListQuerySchema = adminPaginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  missingOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const moderationQuerySchema = adminPaginationSchema.extend({
  type: z.enum(['vendor', 'feed_item', 'all']).optional(),
});

export const seedRunBodySchema = z
  .object({
    target: z.enum(['feed_items', 'vendors', 'all']).default('all'),
  })
  .strict();

export const recommendationRulesBodySchema = z.object({
  rules: z.unknown(),
});

export const feedAnalyticsQuerySchema = z.object({
  periodDays: z.coerce.number().int().min(7).max(365).default(30),
});
