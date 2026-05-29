import { z } from "zod";

export const themePreferenceSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);

export const syncSettingsBodySchema = z
  .object({
    theme: themePreferenceSchema.optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    acceptPrivacyVersion: z.string().trim().min(1).max(64).optional(),
    acceptTermsVersion: z.string().trim().min(1).max(64).optional(),
    acceptAiVersion: z.string().trim().min(1).max(64).optional(),
    acceptAiSurface: z
      .enum([
        'FIRST_AI_USE',
        'AI_HOME',
        'AI_CHAT',
        'AI_RECOMMENDATIONS',
        'AI_ADVISORY',
        'SETTINGS',
      ])
      .optional(),
    acceptVetVersion: z.string().trim().min(1).max(64).optional(),
    acceptVetSurface: z
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
    acceptVetServiceRequestId: z.string().trim().min(1).max(128).optional(),
    acceptEmergencyVersion: z.string().trim().min(1).max(64).optional(),
    acceptEmergencySurface: z
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
    acceptEmergencyServiceRequestId: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export type SyncSettingsBody = z.infer<typeof syncSettingsBodySchema>;
