import { z } from 'zod';

import { bdPhoneSchema, emailSchema, paginationSchema } from '../../shared/validation/index.js';

export const createUserSchema = z.object({
  phone: bdPhoneSchema,
  name: z.string().min(2).max(100).optional(),
  email: emailSchema.optional(),
  role: z.enum(['USER', 'ADMIN', 'DOCTOR', 'TECHNICIAN', 'SUPPORT', 'MANAGER']).default('USER'),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: emailSchema.optional(),
  language: z.enum(['bn', 'en']).optional(),
});

export const updateUserProfileSchema = z.object({
  avatarUrl: z.string().url().optional(),
  address: z.string().max(500).optional(),
  district: z.string().max(50).optional(),
  division: z.string().max(50).optional(),
  preferences: z.object({
    notifications: z.boolean().optional(),
    language: z.enum(['bn', 'en']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }).optional(),
});

export const userFilterSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'DOCTOR', 'TECHNICIAN', 'SUPPORT', 'MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  search: z.string().max(100).optional(),
}).merge(paginationSchema);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
