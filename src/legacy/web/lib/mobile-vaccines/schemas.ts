import { z } from "zod";

import { VaccineStatus } from "@/generated/prisma/client";

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

export const listVaccineQuerySchema = z.object({
  animalId: z.string().trim().min(1).optional(),
  status: z.nativeEnum(VaccineStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createVaccineBodySchema = z
  .object({
    animalId: z.string().trim().min(1).optional(),
    farmRef: z.string().trim().max(200).optional(),
    vaccineName: z.string().trim().min(1).max(200),
    vaccineType: z.string().trim().max(100).optional(),
    scheduledDate: dateStringSchema,
    administeredDate: dateStringSchema.optional(),
    nextDueDate: dateStringSchema.optional(),
    batchNumber: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const patchVaccineBodySchema = z
  .object({
    animalId: z.string().trim().min(1).nullable().optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    vaccineName: z.string().trim().min(1).max(200).optional(),
    vaccineType: z.string().trim().max(100).nullable().optional(),
    scheduledDate: dateStringSchema.optional(),
    administeredDate: dateStringSchema.nullable().optional(),
    nextDueDate: dateStringSchema.nullable().optional(),
    status: z.nativeEnum(VaccineStatus).optional(),
    batchNumber: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();

export type ListVaccineQuery = z.infer<typeof listVaccineQuerySchema>;
export type CreateVaccineBody = z.infer<typeof createVaccineBodySchema>;
export type PatchVaccineBody = z.infer<typeof patchVaccineBodySchema>;
