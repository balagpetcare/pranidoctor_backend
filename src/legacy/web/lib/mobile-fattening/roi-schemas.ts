import { z } from "zod";

export const upsertBatchRoiBodySchema = z
  .object({
    purchaseCostBdt: z.coerce.number().min(0).max(99999999).nullable().optional(),
    projectedSaleBdt: z.coerce.number().min(0).max(99999999).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type UpsertBatchRoiBody = z.infer<typeof upsertBatchRoiBodySchema>;
