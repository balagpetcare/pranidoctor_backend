import { z } from 'zod';

import { cuidSchema, bdPhoneSchema, paginationSchema } from '../../shared/validation/index.js';

const typeEnum = z.enum([
  'OTP',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'LEAD_ASSIGNED',
  'DOCTOR_VERIFIED',
  'EMERGENCY_ALERT',
  'PAYMENT_RECEIVED',
  'SYSTEM',
  'MARKETING',
]);
const channelEnum = z.enum(['SMS', 'EMAIL', 'PUSH', 'IN_APP']);
const statusEnum = z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ']);

export const createNotificationSchema = z.object({
  userId: cuidSchema,
  type: typeEnum,
  channel: channelEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  data: z.record(z.unknown()).optional(),
  scheduledFor: z.coerce.date().optional(),
});

export const sendSmsSchema = z.object({
  phone: bdPhoneSchema,
  message: z.string().min(1).max(500),
  type: typeEnum.optional(),
});

export const sendPushSchema = z.object({
  userId: cuidSchema,
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.unknown()).optional(),
});

export const notificationFilterSchema = z.object({
  userId: cuidSchema.optional(),
  type: typeEnum.optional(),
  channel: channelEnum.optional(),
  status: statusEnum.optional(),
  unreadOnly: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
}).merge(paginationSchema);

export const markReadSchema = z.object({
  notificationIds: z.array(cuidSchema).min(1).max(100),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type SendPushInput = z.infer<typeof sendPushSchema>;
export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
