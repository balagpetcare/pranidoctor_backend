import { z } from "zod";

import { AnimalType } from "@/generated/prisma/client";

const trimmedNonEmpty = z.string().trim().min(1);

export const listAiServiceTechniciansQuerySchema = z
  .object({
    district: trimmedNonEmpty,
    upazila: trimmedNonEmpty,
    unionOrArea: z.string().trim().max(200).optional(),
    animalType: z.nativeEnum(AnimalType).optional(),
    /** Raw query string; parsed in service (`true`/`1`/`yes`). */
    emergency: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export type ListAiServiceTechniciansQuery = z.infer<
  typeof listAiServiceTechniciansQuerySchema
>;

export const createAiServiceRequestBodySchema = z
  .object({
    animalType: z.nativeEnum(AnimalType),
    district: trimmedNonEmpty.max(120),
    upazila: trimmedNonEmpty.max(120),
    addressDetail: trimmedNonEmpty.max(4000),
    technicianProfileId: z.string().trim().min(1).optional(),
    serviceId: z.string().trim().min(1).optional(),
    unionOrArea: z.string().trim().max(200).optional().nullable(),
    breed: z.string().trim().max(200).optional().nullable(),
    animalAge: z.string().trim().max(120).optional().nullable(),
    lastHeatDate: z.string().trim().max(40).optional().nullable(),
    heatSymptoms: z.string().trim().max(4000).optional().nullable(),
    previousAiHistory: z.string().trim().max(4000).optional().nullable(),
    healthIssueNote: z.string().trim().max(4000).optional().nullable(),
    preferredTime: z.string().trim().max(400).optional().nullable(),
    isEmergency: z.boolean().optional(),
    note: z.string().trim().max(4000).optional().nullable(),
  })
  .strict();

export type CreateAiServiceRequestBody = z.infer<
  typeof createAiServiceRequestBodySchema
>;

export const listMyAiServiceRequestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export type ListMyAiServiceRequestsQuery = z.infer<
  typeof listMyAiServiceRequestsQuerySchema
>;
