import { z } from "zod";

const urlOrEmpty = z.union([z.string().trim().url().max(2000), z.literal("")]);

export const adminLegalSettingsPutSchema = z
  .object({
    privacyPolicyUrl: urlOrEmpty.optional(),
    termsOfServiceUrl: urlOrEmpty.optional(),
    privacyVersion: z.string().trim().min(1).max(64).optional(),
    termsVersion: z.string().trim().min(1).max(64).optional(),
    aiConsentVersion: z.string().trim().min(1).max(64).optional(),
    privacyTitle: z.string().trim().min(1).max(200).optional(),
    termsTitle: z.string().trim().min(1).max(200).optional(),
    aiConsentTitle: z.string().trim().min(1).max(200).optional(),
    privacyContent: z.string().trim().min(1).max(12000).optional(),
    termsContent: z.string().trim().min(1).max(12000).optional(),
    aiConsentContent: z.string().trim().min(1).max(12000).optional(),
    enforcePrivacyConsent: z.boolean().optional(),
  })
  .strict();

export type AdminLegalSettingsPutBody = z.infer<typeof adminLegalSettingsPutSchema>;

export const adminLegalConsentQuerySchema = z.object({
  consentType: z.enum(['PRIVACY', 'TERMS', 'AI_PROCESSING', 'VET_ADVICE']).optional(),
  userId: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
