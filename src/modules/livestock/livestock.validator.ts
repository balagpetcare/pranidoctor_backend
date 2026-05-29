import { z } from 'zod';

import {
  LivestockGender,
  LivestockHealthStatus,
  LivestockLifecycleStatus,
  LivestockPurpose,
  LivestockSpecies,
  PregnancyStatus,
} from '@/generated/prisma/client';

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from './constants.js';

const farmRefSchema = z.string().trim().min(1).max(200);
const optionalDateSchema = z
  .union([z.string().trim().min(1), z.coerce.date()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const createLivestockSchema = z
  .object({
    farmRef: farmRefSchema,
    deploymentBranch: z.string().trim().max(120).optional().nullable(),
    name: z.string().trim().min(1).max(120),
    species: z.nativeEnum(LivestockSpecies),
    customSpeciesLabel: z.string().trim().min(1).max(120).optional().nullable(),
    breedId: z.string().trim().min(1).optional().nullable(),
    breedName: z.string().trim().max(120).optional().nullable(),
    gender: z.nativeEnum(LivestockGender),
    purpose: z.nativeEnum(LivestockPurpose).optional(),
    healthStatus: z.nativeEnum(LivestockHealthStatus).optional(),
    dateOfBirth: optionalDateSchema,
    weightKg: z.coerce.number().positive().max(99999).optional().nullable(),
    earTagNumber: z.string().trim().max(80).optional().nullable(),
    pregnancyStatus: z.nativeEnum(PregnancyStatus).optional().nullable(),
    lactationNumber: z.coerce.number().int().min(0).max(99).optional().nullable(),
    lastCalvingDate: optionalDateSchema,
    photoUrl: z.string().trim().url().max(2048).optional().nullable(),
    purchaseDate: optionalDateSchema,
    purchasePriceBdt: z.coerce.number().nonnegative().max(999999999).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.species === LivestockSpecies.CUSTOM && !data.customSpeciesLabel?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customSpeciesLabel is required when species is CUSTOM',
        path: ['customSpeciesLabel'],
      });
    }
  });

export const updateLivestockSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    species: z.nativeEnum(LivestockSpecies).optional(),
    customSpeciesLabel: z.string().trim().min(1).max(120).optional().nullable(),
    breedId: z.string().trim().min(1).optional().nullable(),
    breedName: z.string().trim().max(120).optional().nullable(),
    gender: z.nativeEnum(LivestockGender).optional(),
    purpose: z.nativeEnum(LivestockPurpose).optional(),
    lifecycleStatus: z.nativeEnum(LivestockLifecycleStatus).optional(),
    healthStatus: z.nativeEnum(LivestockHealthStatus).optional(),
    dateOfBirth: optionalDateSchema,
    weightKg: z.coerce.number().positive().max(99999).optional().nullable(),
    earTagNumber: z.string().trim().max(80).optional().nullable(),
    pregnancyStatus: z.nativeEnum(PregnancyStatus).optional().nullable(),
    lactationNumber: z.coerce.number().int().min(0).max(99).optional().nullable(),
    lastCalvingDate: optionalDateSchema,
    photoUrl: z.string().trim().url().max(2048).optional().nullable(),
    purchaseDate: optionalDateSchema,
    purchasePriceBdt: z.coerce.number().nonnegative().max(999999999).optional().nullable(),
    saleDate: optionalDateSchema,
    salePriceBdt: z.coerce.number().nonnegative().max(999999999).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.species === LivestockSpecies.CUSTOM && data.customSpeciesLabel === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customSpeciesLabel cannot be cleared when species is CUSTOM',
        path: ['customSpeciesLabel'],
      });
    }
  });

export const listLivestockQuerySchema = z.object({
  farmRef: farmRefSchema.optional(),
  species: z.nativeEnum(LivestockSpecies).optional(),
  lifecycleStatus: z.nativeEnum(LivestockLifecycleStatus).optional(),
  gender: z.nativeEnum(LivestockGender).optional(),
  search: z.string().trim().max(120).optional(),
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => value === true || value === 'true'),
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createLivestockImageSchema = z
  .object({
    url: z.string().trim().url().max(2048),
    uploadedFileId: z.string().trim().min(1).optional().nullable(),
    caption: z.string().trim().max(500).optional().nullable(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strict();

export type CreateLivestockBody = z.infer<typeof createLivestockSchema>;
export type UpdateLivestockBody = z.infer<typeof updateLivestockSchema>;
export type ListLivestockQuery = z.infer<typeof listLivestockQuerySchema>;
export type CreateLivestockImageBody = z.infer<typeof createLivestockImageSchema>;
