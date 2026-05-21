import { z } from 'zod';

export const bdPhoneSchema = z
  .string()
  .regex(/^(?:\+880|880|0)?1[3-9]\d{8}$/, 'Invalid Bangladesh phone number')
  .transform((val) => {
    const digits = val.replace(/\D/g, '');
    if (digits.startsWith('880')) return `+${digits}`;
    if (digits.startsWith('0')) return `+88${digits}`;
    return `+880${digits}`;
  });

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

export const cuidSchema = z.string().cuid('Invalid ID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine((data) => {
  if (data.from && data.to) {
    return data.from <= data.to;
  }
  return true;
}, { message: 'From date must be before to date' });

export const bdtAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')
  .max(10000000, 'Amount exceeds maximum limit');

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email too long');
