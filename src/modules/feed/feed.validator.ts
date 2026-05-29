import { FeedCategory, FeedMoistureType, FeedUnit } from '@/generated/prisma/client';
import { z } from 'zod';

import {
  FEED_DEFAULT_LIMIT,
  FEED_DEFAULT_PAGE,
  FEED_ITEM_DEFAULT_SORT,
  FEED_ITEM_SORT_FIELDS,
  FEED_MAX_LIMIT,
} from './constants.js';

const sortOrderSchema = z.enum(['asc', 'desc']);

const feedNutritionSchema = z
  .object({
    cpPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    tdnPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    cfPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    eePercent: z.coerce.number().min(0).max(100).nullable().optional(),
    caPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    pPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    dmPercent: z.coerce.number().min(0).max(100).nullable().optional(),
    source: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const listFeedItemsQuerySchema = z.object({
  category: z.nativeEnum(FeedCategory).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      return v === true || v === 'true';
    }),
  page: z.coerce.number().int().min(1).default(FEED_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).default(FEED_DEFAULT_LIMIT),
  sortBy: z.enum(FEED_ITEM_SORT_FIELDS).default(FEED_ITEM_DEFAULT_SORT),
  sortOrder: sortOrderSchema.default('asc'),
});

export const createFeedItemBodySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .transform((v) => v.toLowerCase()),
    category: z.nativeEnum(FeedCategory),
    nameBn: z.string().trim().min(1).max(200),
    nameEn: z.string().trim().min(1).max(200),
    defaultUnit: z.nativeEnum(FeedUnit),
    approxPriceBdt: z.coerce.number().min(0).max(999999).nullable().optional(),
    moistureType: z.nativeEnum(FeedMoistureType).optional(),
    isSeasonal: z.boolean().optional(),
    seasonNotesBn: z.string().trim().max(500).nullable().optional(),
    seasonNotesEn: z.string().trim().max(500).nullable().optional(),
    restrictionJson: z.unknown().nullable().optional(),
    suitabilityJson: z.unknown().nullable().optional(),
    isSeeded: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    nutrition: feedNutritionSchema.optional(),
  })
  .strict();

export const updateFeedItemBodySchema = z
  .object({
    category: z.nativeEnum(FeedCategory).optional(),
    nameBn: z.string().trim().min(1).max(200).optional(),
    nameEn: z.string().trim().min(1).max(200).optional(),
    defaultUnit: z.nativeEnum(FeedUnit).optional(),
    approxPriceBdt: z.coerce.number().min(0).max(999999).nullable().optional(),
    moistureType: z.nativeEnum(FeedMoistureType).optional(),
    isSeasonal: z.boolean().optional(),
    seasonNotesBn: z.string().trim().max(500).nullable().optional(),
    seasonNotesEn: z.string().trim().max(500).nullable().optional(),
    restrictionJson: z.unknown().nullable().optional(),
    suitabilityJson: z.unknown().nullable().optional(),
    isSeeded: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    nutrition: feedNutritionSchema.nullable().optional(),
  })
  .strict();

export type ListFeedItemsQueryInput = z.infer<typeof listFeedItemsQuerySchema>;
export type CreateFeedItemBodyInput = z.infer<typeof createFeedItemBodySchema>;
export type UpdateFeedItemBodyInput = z.infer<typeof updateFeedItemBodySchema>;

/** Admin list — does not default `isActive` to true (show all when omitted). */
export const adminListFeedItemsQuerySchema = z.object({
  category: z.nativeEnum(FeedCategory).optional(),
  search: z.string().trim().max(120).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === true || v === 'true';
    }),
  page: z.coerce.number().int().min(1).default(FEED_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).default(FEED_DEFAULT_LIMIT),
  sortBy: z.enum(FEED_ITEM_SORT_FIELDS).default(FEED_ITEM_DEFAULT_SORT),
  sortOrder: sortOrderSchema.default('asc'),
});

export type AdminListFeedItemsQueryInput = z.infer<typeof adminListFeedItemsQuerySchema>;
