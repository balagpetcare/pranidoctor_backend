import { z } from "zod";

import { FarmTreatmentStatus } from "@/generated/prisma/client";

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

const medicineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.string().trim().min(1).max(200),
  frequency: z.string().trim().max(100).optional(),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const listTreatmentQuerySchema = z.object({
  animalId: z.string().trim().min(1).optional(),
  status: z.nativeEnum(FarmTreatmentStatus).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTreatmentBodySchema = z
  .object({
    animalId: z.string().trim().min(1).optional(),
    farmRef: z.string().trim().max(200).optional(),
    title: z.string().trim().min(1).max(200),
    diagnosis: z.string().trim().max(2000).optional(),
    prescription: z.string().trim().max(4000).optional(),
    medicines: z.array(medicineSchema).max(20).optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema.optional(),
    status: z.nativeEnum(FarmTreatmentStatus).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const patchTreatmentBodySchema = z
  .object({
    animalId: z.string().trim().min(1).nullable().optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    diagnosis: z.string().trim().max(2000).nullable().optional(),
    prescription: z.string().trim().max(4000).nullable().optional(),
    medicines: z.array(medicineSchema).max(20).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.nullable().optional(),
    status: z.nativeEnum(FarmTreatmentStatus).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type ListTreatmentQuery = z.infer<typeof listTreatmentQuerySchema>;
export type CreateTreatmentBody = z.infer<typeof createTreatmentBodySchema>;
export type PatchTreatmentBody = z.infer<typeof patchTreatmentBodySchema>;
