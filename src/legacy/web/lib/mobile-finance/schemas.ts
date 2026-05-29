import { z } from "zod";

import { ExpenseCategory, IncomeSource } from "@/generated/prisma/client";

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

export const listFinanceQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  source: z.nativeEnum(IncomeSource).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createExpenseBodySchema = z
  .object({
    amountBdt: z.coerce.number().positive().max(99999999),
    category: z.nativeEnum(ExpenseCategory),
    recordedDate: dateStringSchema,
    farmRef: z.string().trim().max(200).optional(),
    fatteningBatchId: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const patchExpenseBodySchema = z
  .object({
    amountBdt: z.coerce.number().positive().max(99999999).optional(),
    category: z.nativeEnum(ExpenseCategory).optional(),
    recordedDate: dateStringSchema.optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    fatteningBatchId: z.string().trim().min(1).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const createIncomeBodySchema = z
  .object({
    amountBdt: z.coerce.number().positive().max(99999999),
    source: z.nativeEnum(IncomeSource),
    recordedDate: dateStringSchema,
    farmRef: z.string().trim().max(200).optional(),
    fatteningBatchId: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const patchIncomeBodySchema = z
  .object({
    amountBdt: z.coerce.number().positive().max(99999999).optional(),
    source: z.nativeEnum(IncomeSource).optional(),
    recordedDate: dateStringSchema.optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    fatteningBatchId: z.string().trim().min(1).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export const financeRangeQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export type ListFinanceQuery = z.infer<typeof listFinanceQuerySchema>;
export type CreateExpenseBody = z.infer<typeof createExpenseBodySchema>;
export type PatchExpenseBody = z.infer<typeof patchExpenseBodySchema>;
export type CreateIncomeBody = z.infer<typeof createIncomeBodySchema>;
export type PatchIncomeBody = z.infer<typeof patchIncomeBodySchema>;
export type FinanceRangeQuery = z.infer<typeof financeRangeQuerySchema>;
