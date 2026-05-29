import { z } from 'zod';

import {
  LivestockGender,
  LivestockHealthStatus,
  LivestockPurpose,
  LivestockSpecies,
  PregnancyStatus,
} from '@/generated/prisma/client';

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const previewRecommendationBodySchema = z
  .object({
    species: z.nativeEnum(LivestockSpecies),
    gender: z.nativeEnum(LivestockGender).default(LivestockGender.UNKNOWN),
    weightKg: z.coerce.number().positive().max(99999).optional(),
    ageMonths: z.coerce.number().int().min(0).max(600).optional(),
    purpose: z.nativeEnum(LivestockPurpose).optional(),
    pregnancyStatus: z.nativeEnum(PregnancyStatus).optional(),
    healthStatus: z.nativeEnum(LivestockHealthStatus).default(LivestockHealthStatus.HEALTHY),
    planDate: dateStringSchema.optional(),
  })
  .strict();

export const dailyRecommendationQuerySchema = z.object({
  livestockId: z.string().trim().min(1),
  planDate: dateStringSchema.optional(),
});

export const acceptRecommendationBodySchema = z
  .object({
    livestockId: z.string().trim().min(1),
    planDate: dateStringSchema,
    logId: z.string().trim().min(1).optional(),
  })
  .strict();

export type PreviewRecommendationBody = z.infer<typeof previewRecommendationBodySchema>;
export type DailyRecommendationQuery = z.infer<typeof dailyRecommendationQuerySchema>;
export type AcceptRecommendationBody = z.infer<typeof acceptRecommendationBodySchema>;
