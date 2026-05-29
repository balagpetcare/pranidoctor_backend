import { z } from "zod";

import { BatchFeedPlanMode, FeedType, FeedUnit } from "@/generated/prisma/client";

const modeSchema = z.nativeEnum(BatchFeedPlanMode);
const feedTypeSchema = z.nativeEnum(FeedType);
const feedUnitSchema = z.nativeEnum(FeedUnit);

export const upsertBatchFeedPlanBodySchema = z
  .object({
    mode: modeSchema.default(BatchFeedPlanMode.FATTENING),
    dailyAmountKg: z.coerce.number().positive().max(999999).optional(),
    dailyCostBdt: z.coerce.number().min(0).max(99999999).optional(),
    feedType: feedTypeSchema.optional(),
    unit: feedUnitSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type UpsertBatchFeedPlanBody = z.infer<typeof upsertBatchFeedPlanBodySchema>;
