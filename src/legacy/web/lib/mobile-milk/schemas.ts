import { z } from "zod";

import { MilkSession } from "@/generated/prisma/client";

const milkSessionSchema = z.nativeEnum(MilkSession);

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

export const listMilkQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  animalId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createMilkBodySchema = z
  .object({
    animalId: z.string().trim().min(1),
    farmRef: z.string().trim().max(200).optional(),
    recordedDate: dateStringSchema,
    session: milkSessionSchema,
    quantityLiters: z.coerce.number().positive().max(9999),
    notes: z.string().trim().max(2000).optional(),
    clientId: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
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

export const patchMilkBodySchema = z
  .object({
    animalId: z.string().trim().min(1).optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    recordedDate: dateStringSchema.optional(),
    session: milkSessionSchema.optional(),
    quantityLiters: z.coerce.number().positive().max(9999).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const milkSummaryQuerySchema = z.object({
  date: dateStringSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const milkChartsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

export type CreateMilkBody = z.infer<typeof createMilkBodySchema>;
export type PatchMilkBody = z.infer<typeof patchMilkBodySchema>;
export type ListMilkQuery = z.infer<typeof listMilkQuerySchema>;
export type MilkSummaryQuery = z.infer<typeof milkSummaryQuerySchema>;
export type MilkChartsQuery = z.infer<typeof milkChartsQuerySchema>;
