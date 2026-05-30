import { z } from 'zod';

export const betaCohortSchema = z.enum(['C0', 'C1', 'C2', 'C3', 'C4', 'NONE']);

export const closedBetaConfigPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    enforceInviteList: z.boolean().optional(),
    enforceUserCap: z.boolean().optional(),
    maxUsers: z.number().int().min(1).max(500).optional(),
    maxDoctors: z.number().int().min(1).max(50).optional(),
    activeCohort: betaCohortSchema.optional(),
    invitedPhones: z.array(z.string().trim().min(8).max(20)).optional(),
    pilotAreaIds: z.array(z.string().trim().min(1)).optional(),
    feedbackEnabled: z.boolean().optional(),
    betaBanner: z
      .object({
        en: z.string().trim().max(500).optional(),
        bn: z.string().trim().max(500).optional(),
      })
      .nullable()
      .optional(),
    doctorSupportWhatsapp: z.string().trim().max(20).nullable().optional(),
    userSupportWhatsapp: z.string().trim().max(20).nullable().optional(),
    monitoringLinks: z
      .object({
        grafana: z.string().url().optional(),
        sentry: z.string().url().optional(),
        uptime: z.string().url().optional(),
        launchOps: z.string().url().optional(),
      })
      .optional(),
    contentVersion: z.string().trim().max(32).optional(),
  })
  .strict();

export const tagBetaUserBodySchema = z.object({
  cohort: betaCohortSchema,
  note: z.string().trim().max(500).optional(),
});

export const tagBetaDoctorBodySchema = z.object({
  cohort: betaCohortSchema,
  note: z.string().trim().max(500).optional(),
  acceptsEmergency: z.boolean().optional(),
});

export const addInvitedPhoneBodySchema = z.object({
  phone: z.string().trim().min(8).max(20),
});

export const betaFeedbackBodySchema = z.object({
  message: z.string().trim().min(10).max(5000),
  rating: z.number().int().min(1).max(5).optional(),
  screen: z.string().trim().max(120).optional(),
  locale: z.string().trim().max(16).optional(),
});
