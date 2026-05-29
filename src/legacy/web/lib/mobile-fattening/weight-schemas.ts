import { z } from "zod";

import { WeightRecordMethod } from "@/generated/prisma/client";

const dateTimeSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date-time string",
  });

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const createWeightBodySchema = z
  .object({
    animalId: z.string().trim().min(1),
    batchId: z.string().trim().min(1),
    weightKg: z.coerce.number().positive().max(99999),
    recordedAt: dateTimeSchema.optional(),
    recordedOn: dateOnlySchema.optional(),
    method: z.nativeEnum(WeightRecordMethod).optional(),
    note: z.string().trim().max(2000).optional(),
    photoUrl: z.string().trim().url().max(2000).optional(),
    clientRecordId: z.string().trim().max(120).optional(),
  })
  .strict();

export const listWeightQuerySchema = z.object({
  batchId: z.string().trim().min(1),
  animalId: z.string().trim().min(1).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateWeightBody = z.infer<typeof createWeightBodySchema>;
export type ListWeightQuery = z.infer<typeof listWeightQuerySchema>;
