import { z } from 'zod';

const localeTextPatch = z
  .object({
    en: z.string().trim().min(1).max(4000).optional(),
    bn: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

const contextualPatch = z
  .object({
    emergency: localeTextPatch.optional(),
    high: localeTextPatch.optional(),
    lowConfidence: localeTextPatch.optional(),
    policyRefusal: localeTextPatch.optional(),
    supportVsVet: localeTextPatch.optional(),
    humanReview: localeTextPatch.optional(),
    escalationRecorded: localeTextPatch.optional(),
    keywordLimitation: localeTextPatch.optional(),
  })
  .strict();

export const adminAiEscalationDisclosurePutSchema = z
  .object({
    contentVersion: z.string().trim().min(1).max(64).optional(),
    banner: localeTextPatch.optional(),
    full: localeTextPatch.optional(),
    contextual: contextualPatch.optional(),
  })
  .strict();

export type AdminAiEscalationDisclosurePutBody = z.infer<
  typeof adminAiEscalationDisclosurePutSchema
>;
