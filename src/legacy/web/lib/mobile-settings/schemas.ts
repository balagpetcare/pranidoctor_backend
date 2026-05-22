import { z } from "zod";

export const themePreferenceSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);

export const syncSettingsBodySchema = z
  .object({
    theme: themePreferenceSchema.optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    acceptPrivacyVersion: z.string().trim().min(1).max(64).optional(),
    acceptTermsVersion: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type SyncSettingsBody = z.infer<typeof syncSettingsBodySchema>;
