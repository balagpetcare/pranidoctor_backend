import { z } from 'zod';

import { cuidSchema, paginationSchema } from '../../shared/validation/index.js';

const conversationStatusEnum = z.enum(['ACTIVE', 'ENDED', 'ESCALATED', 'ABANDONED']);
const emergencyLevelEnum = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const contextSchema = z.object({
  animalType: z.string().max(50).optional(),
  symptoms: z.array(z.string().max(100)).max(20).optional(),
  urgencyIndicators: z.array(z.string().max(100)).max(10).optional(),
  previousDiagnosis: z.array(z.string().max(200)).max(10).optional(),
});

export const startConversationSchema = z.object({
  userId: cuidSchema,
  context: contextSchema.optional(),
});

export const sendMessageSchema = z.object({
  conversationId: cuidSchema,
  content: z.string().min(1).max(4000),
});

export const endConversationSchema = z.object({
  conversationId: cuidSchema,
  reason: z.string().max(500).optional(),
});

export const chatRequestSchema = z.object({
  conversationId: cuidSchema.optional(),
  message: z.string().min(1).max(4000),
  context: contextSchema.optional(),
});

export const conversationFilterSchema = z.object({
  userId: cuidSchema.optional(),
  status: conversationStatusEnum.optional(),
  emergencyLevel: emergencyLevelEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).merge(paginationSchema);

export type StartConversationInput = z.infer<typeof startConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EndConversationInput = z.infer<typeof endConversationSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type ConversationFilterInput = z.infer<typeof conversationFilterSchema>;
