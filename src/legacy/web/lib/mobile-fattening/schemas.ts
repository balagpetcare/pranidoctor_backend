import { z } from "zod";

import {
  FatteningBatchGoalType,
  FatteningBatchStatus,
} from "@/generated/prisma/client";

const statusSchema = z.nativeEnum(FatteningBatchStatus);

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

const farmIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((v) => v.startsWith("farm-"), {
    message: "farmId must start with farm-",
  });

export const listFatteningBatchesQuerySchema = z.object({
  farmId: farmIdSchema,
  status: statusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const goalTypeSchema = z.nativeEnum(FatteningBatchGoalType);

export const createFatteningBatchBodySchema = z
  .object({
    farmId: farmIdSchema,
    name: z.string().trim().min(1).max(120),
    goalType: goalTypeSchema.optional(),
    goal: z.string().trim().max(500).optional(),
    targetDate: dateStringSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const goalType = data.goalType ?? FatteningBatchGoalType.NORMAL;
    if (goalType === FatteningBatchGoalType.QURBANI && !data.targetDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetDate is required for QURBANI batches",
        path: ["targetDate"],
      });
    }
  });

export const startFatteningBatchBodySchema = z
  .object({
    startDate: dateStringSchema.optional(),
  })
  .strict();

export const addFatteningBatchAnimalsBodySchema = z
  .object({
    animalIds: z.array(z.string().trim().min(1)).min(1).max(200),
  })
  .strict();

export type ListFatteningBatchesQuery = z.infer<
  typeof listFatteningBatchesQuerySchema
>;
export type CreateFatteningBatchBody = z.infer<
  typeof createFatteningBatchBodySchema
>;
export type StartFatteningBatchBody = z.infer<
  typeof startFatteningBatchBodySchema
>;
export type AddFatteningBatchAnimalsBody = z.infer<
  typeof addFatteningBatchAnimalsBodySchema
>;
