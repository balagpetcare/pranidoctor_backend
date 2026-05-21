import { z } from 'zod';

import { bdPhoneSchema, cuidSchema, paginationSchema } from '../../shared/validation/index.js';

const sourceEnum = z.enum(['AI_CHAT', 'PHONE', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'WALK_IN', 'OTHER']);
const statusEnum = z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONSULTATION_SCHEDULED', 'CONVERTED', 'LOST', 'FOLLOW_UP']);
const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createLeadSchema = z.object({
  phone: bdPhoneSchema,
  name: z.string().min(2).max(100).optional(),
  userId: cuidSchema.optional(),
  source: sourceEnum,
  animalType: z.string().max(50).optional(),
  concern: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  priority: priorityEnum.default('MEDIUM'),
});

export const updateLeadSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  notes: z.string().max(2000).optional(),
  concern: z.string().max(1000).optional(),
});

export const assignLeadSchema = z.object({
  assignedTo: cuidSchema,
});

export const convertLeadSchema = z.object({
  userId: cuidSchema,
});

export const leadFilterSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  source: sourceEnum.optional(),
  assignedTo: cuidSchema.optional(),
  search: z.string().max(100).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).merge(paginationSchema);

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type LeadFilterInput = z.infer<typeof leadFilterSchema>;
