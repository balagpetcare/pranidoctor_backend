import { z } from 'zod';

const localeTextPatch = z
  .object({
    en: z.string().trim().min(1).max(4000).optional(),
    bn: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

const contextualPatch = z
  .object({
    instantCare: localeTextPatch.optional(),
    aiEmergency: localeTextPatch.optional(),
    bookingEmergency: localeTextPatch.optional(),
    discoveryEmergency: localeTextPatch.optional(),
    requestPending: localeTextPatch.optional(),
    bookingOnline: localeTextPatch.optional(),
    phoneDial: localeTextPatch.optional(),
  })
  .strict();

export const adminEmergencyLimitationPutSchema = z
  .object({
    contentVersion: z.string().trim().min(1).max(64).optional(),
    enforceAcceptance: z.boolean().optional(),
    consentVersion: z.string().trim().min(1).max(64).optional(),
    consentTitle: z.string().trim().min(1).max(200).optional(),
    banner: localeTextPatch.optional(),
    urgent: localeTextPatch.optional(),
    full: localeTextPatch.optional(),
    contextual: contextualPatch.optional(),
  })
  .strict();

export type AdminEmergencyLimitationPutBody = z.infer<typeof adminEmergencyLimitationPutSchema>;

export const emergencyLimitationAcceptBodySchema = z
  .object({
    version: z.string().trim().min(1).max(64),
    surface: z
      .enum([
        'FIRST_EMERGENCY_USE',
        'INSTANT_CARE',
        'BOOKING_EMERGENCY',
        'DISCOVERY_EMERGENCY',
        'SERVICE_REQUEST_DETAIL',
        'AI_EMERGENCY',
        'PHONE_DIAL',
        'SETTINGS',
      ])
      .optional(),
    serviceRequestId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export type EmergencyLimitationAcceptBody = z.infer<typeof emergencyLimitationAcceptBodySchema>;
