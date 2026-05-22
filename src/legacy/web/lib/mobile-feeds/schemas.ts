import { z } from "zod";

import { FeedType, FeedUnit } from "@/generated/prisma/client";

const feedTypeSchema = z.nativeEnum(FeedType);
const feedUnitSchema = z.nativeEnum(FeedUnit);

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

export const listFeedsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  animalId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  feedType: feedTypeSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createFeedBodySchema = z
  .object({
    farmRef: z.string().trim().max(200).optional(),
    animalId: z.string().trim().min(1).optional(),
    batchId: z.string().trim().max(120).optional(),
    batchName: z.string().trim().max(200).optional(),
    feedType: feedTypeSchema,
    amount: z.coerce.number().positive().max(999999),
    unit: feedUnitSchema,
    costBdt: z.coerce.number().min(0).max(99999999).optional(),
    recordedDate: dateStringSchema,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.animalId && !data.batchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either animalId or batchId is required",
        path: ["animalId"],
      });
    }
    const d = new Date(data.recordedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recordedDate cannot be in the future",
        path: ["recordedDate"],
      });
    }
  });

export const patchFeedBodySchema = z
  .object({
    farmRef: z.string().trim().max(200).nullable().optional(),
    animalId: z.string().trim().min(1).nullable().optional(),
    batchId: z.string().trim().max(120).nullable().optional(),
    batchName: z.string().trim().max(200).nullable().optional(),
    feedType: feedTypeSchema.optional(),
    amount: z.coerce.number().positive().max(999999).optional(),
    unit: feedUnitSchema.optional(),
    costBdt: z.coerce.number().min(0).max(99999999).nullable().optional(),
    recordedDate: dateStringSchema.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const feedCostQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const feedAnalyticsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export type CreateFeedBody = z.infer<typeof createFeedBodySchema>;
export type PatchFeedBody = z.infer<typeof patchFeedBodySchema>;
export type ListFeedsQuery = z.infer<typeof listFeedsQuerySchema>;
export type FeedCostQuery = z.infer<typeof feedCostQuerySchema>;
export type FeedAnalyticsQuery = z.infer<typeof feedAnalyticsQuerySchema>;
