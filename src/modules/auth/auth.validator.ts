import { z } from 'zod';

import { bdPhoneSchema, otpCodeSchema } from '../../shared/validation/index.js';

export const requestOtpSchema = z.object({
  phone: bdPhoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: bdPhoneSchema,
  code: otpCodeSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
