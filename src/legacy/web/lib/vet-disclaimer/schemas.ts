import { z } from 'zod';

const localeTextPatch = z
  .object({
    en: z.string().trim().min(1).max(4000).optional(),
    bn: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

const contextualPatch = z
  .object({
    bookingHome: localeTextPatch.optional(),
    bookingEmergency: localeTextPatch.optional(),
    bookingOnline: localeTextPatch.optional(),
    treatmentJournal: localeTextPatch.optional(),
    prescriptionView: localeTextPatch.optional(),
    feedRation: localeTextPatch.optional(),
    instantCare: localeTextPatch.optional(),
  })
  .strict();

export const adminVetDisclaimerPutSchema = z
  .object({
    contentVersion: z.string().trim().min(1).max(64).optional(),
    enforceAcceptance: z.boolean().optional(),
    consentVersion: z.string().trim().min(1).max(64).optional(),
    consentTitle: z.string().trim().min(1).max(200).optional(),
    banner: localeTextPatch.optional(),
    emergency: localeTextPatch.optional(),
    full: localeTextPatch.optional(),
    contextual: contextualPatch.optional(),
  })
  .strict();

export type AdminVetDisclaimerPutBody = z.infer<typeof adminVetDisclaimerPutSchema>;

export const vetDisclaimerAcceptBodySchema = z
  .object({
    version: z.string().trim().min(1).max(64),
    surface: z
      .enum([
        'FIRST_VET_USE',
        'BOOKING_HOME',
        'BOOKING_EMERGENCY',
        'BOOKING_ONLINE',
        'TREATMENT_JOURNAL',
        'INSTANT_CARE',
        'SERVICE_REQUEST_DETAIL',
        'SETTINGS',
      ])
      .optional(),
    serviceRequestId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export type VetDisclaimerAcceptBody = z.infer<typeof vetDisclaimerAcceptBodySchema>;
