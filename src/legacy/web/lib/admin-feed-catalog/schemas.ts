import { z } from "zod";

import { FeedCategory, FeedUnit } from "@/generated/prisma/client";

export const listFeedCatalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.nativeEnum(FeedCategory).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createFeedCatalogBodySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "code must be lowercase alphanumeric with hyphens"),
    nameBn: z.string().trim().min(1).max(200),
    nameEn: z.string().trim().min(1).max(200),
    category: z.nativeEnum(FeedCategory),
    defaultUnit: z.nativeEnum(FeedUnit),
    approxPriceBdt: z.coerce.number().min(0).max(99999999).nullable().optional(),
    nutritionJson: z.record(z.unknown()).nullable().optional(),
    availabilityScore: z.coerce.number().int().min(1).max(5).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const patchFeedCatalogBodySchema = z
  .object({
    nameBn: z.string().trim().min(1).max(200).optional(),
    nameEn: z.string().trim().min(1).max(200).optional(),
    category: z.nativeEnum(FeedCategory).optional(),
    defaultUnit: z.nativeEnum(FeedUnit).optional(),
    approxPriceBdt: z.coerce.number().min(0).max(99999999).nullable().optional(),
    nutritionJson: z.record(z.unknown()).nullable().optional(),
    availabilityScore: z.coerce.number().int().min(1).max(5).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateFeedCatalogBody = z.infer<typeof createFeedCatalogBodySchema>;
export type PatchFeedCatalogBody = z.infer<typeof patchFeedCatalogBodySchema>;
