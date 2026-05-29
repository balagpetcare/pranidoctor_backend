import { z } from 'zod';

const localeTextPatch = z
  .object({
    en: z.string().trim().min(1).max(4000).optional(),
    bn: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

export const adminAiDisclaimerPutSchema = z
  .object({
    contentVersion: z.string().trim().min(1).max(64).optional(),
    enforceAcceptance: z.boolean().optional(),
    consentVersion: z.string().trim().min(1).max(64).optional(),
    consentTitle: z.string().trim().min(1).max(200).optional(),
    consentContent: z.string().trim().min(1).max(12000).optional(),
    banner: localeTextPatch.optional(),
    contextual: z
      .object({
        chat: localeTextPatch.optional(),
        recommendations: localeTextPatch.optional(),
        advisory: localeTextPatch.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type AdminAiDisclaimerPutBody = z.infer<typeof adminAiDisclaimerPutSchema>;

export const aiDisclaimerAcceptBodySchema = z
  .object({
    version: z.string().trim().min(1).max(64),
    surface: z
      .enum([
        'FIRST_AI_USE',
        'AI_HOME',
        'AI_CHAT',
        'AI_RECOMMENDATIONS',
        'AI_ADVISORY',
        'SETTINGS',
      ])
      .optional(),
  })
  .strict();

export type AiDisclaimerAcceptBody = z.infer<typeof aiDisclaimerAcceptBodySchema>;
