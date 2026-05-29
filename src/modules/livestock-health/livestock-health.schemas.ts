import { LivestockHealthRecordType, LivestockVaccinationStatus } from '@/generated/prisma/client';
import { z } from 'zod';

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const healthRecordListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  recordType: z.nativeEnum(LivestockHealthRecordType).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const createHealthRecordBodySchema = z
  .object({
    recordType: z.nativeEnum(LivestockHealthRecordType),
    title: z.string().trim().min(1).max(200),
    symptoms: z.string().trim().max(4000).nullable().optional(),
    diagnosis: z.string().trim().max(4000).nullable().optional(),
    diseaseName: z.string().trim().max(200).nullable().optional(),
    treatmentRef: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    recordedDate: dateStringSchema,
    farmRef: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const updateHealthRecordBodySchema = createHealthRecordBodySchema.partial().strict();

export const vaccinationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(LivestockVaccinationStatus).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});

export const createVaccinationBodySchema = z
  .object({
    vaccineName: z.string().trim().min(1).max(200),
    vaccineType: z.string().trim().max(120).nullable().optional(),
    scheduledDate: dateStringSchema,
    nextDueDate: dateStringSchema.nullable().optional(),
    batchNumber: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    farmRef: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const updateVaccinationBodySchema = createVaccinationBodySchema.partial().strict();

export const markVaccinationCompletedBodySchema = z
  .object({
    administeredDate: dateStringSchema.optional(),
    batchNumber: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    nextDueDate: dateStringSchema.nullable().optional(),
  })
  .strict();

export type HealthRecordListQuery = z.infer<typeof healthRecordListQuerySchema>;
export type CreateHealthRecordBody = z.infer<typeof createHealthRecordBodySchema>;
export type UpdateHealthRecordBody = z.infer<typeof updateHealthRecordBodySchema>;
export type VaccinationListQuery = z.infer<typeof vaccinationListQuerySchema>;
export type CreateVaccinationBody = z.infer<typeof createVaccinationBodySchema>;
export type UpdateVaccinationBody = z.infer<typeof updateVaccinationBodySchema>;
export type MarkVaccinationCompletedBody = z.infer<typeof markVaccinationCompletedBodySchema>;
