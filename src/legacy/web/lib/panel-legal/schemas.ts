import { z } from 'zod';

export const panelLegalAcceptBodySchema = z
  .object({
    documentKey: z.string().trim().min(1).max(64),
    version: z.string().trim().min(1).max(64),
    locale: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

export type PanelLegalAcceptBody = z.infer<typeof panelLegalAcceptBodySchema>;

export const panelLegalDocumentKeySchema = z.string().trim().min(1).max(64);
