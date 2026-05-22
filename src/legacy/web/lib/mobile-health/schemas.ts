import { z } from "zod";

import { HealthEventType } from "@/generated/prisma/client";

const dateStringSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Must be a valid ISO date string",
  });

export const listHealthQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  animalId: z.string().trim().min(1).optional(),
  eventType: z.nativeEnum(HealthEventType).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createHealthBodySchema = z
  .object({
    animalId: z.string().trim().min(1).optional(),
    farmRef: z.string().trim().max(200).optional(),
    eventType: z.nativeEnum(HealthEventType),
    title: z.string().trim().min(1).max(200),
    symptoms: z.string().trim().max(2000).optional(),
    diagnosis: z.string().trim().max(2000).optional(),
    diseaseName: z.string().trim().max(200).optional(),
    treatmentRefId: z.string().trim().optional(),
    vaccineRefId: z.string().trim().optional(),
    notes: z.string().trim().max(2000).optional(),
    recordedDate: dateStringSchema,
  })
  .strict();

export const patchHealthBodySchema = z
  .object({
    animalId: z.string().trim().min(1).nullable().optional(),
    farmRef: z.string().trim().max(200).nullable().optional(),
    eventType: z.nativeEnum(HealthEventType).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    symptoms: z.string().trim().max(2000).nullable().optional(),
    diagnosis: z.string().trim().max(2000).nullable().optional(),
    diseaseName: z.string().trim().max(200).nullable().optional(),
    treatmentRefId: z.string().trim().nullable().optional(),
    vaccineRefId: z.string().trim().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    recordedDate: dateStringSchema.optional(),
  })
  .strict();

export type ListHealthQuery = z.infer<typeof listHealthQuerySchema>;
export type CreateHealthBody = z.infer<typeof createHealthBodySchema>;
export type PatchHealthBody = z.infer<typeof patchHealthBodySchema>;
