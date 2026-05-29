import { FeedVendorVerificationStatus } from '@/generated/prisma/client';
import { z } from 'zod';

export const adminVendorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  verificationStatus: z.nativeEnum(FeedVendorVerificationStatus).optional(),
  districtId: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().max(120).optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

export const createVendorBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    nameBn: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    districtId: z.string().trim().max(64).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateVendorBodySchema = createVendorBodySchema.partial().strict();

export const verifyVendorBodySchema = z
  .object({
    status: z.enum([FeedVendorVerificationStatus.VERIFIED, FeedVendorVerificationStatus.REJECTED]),
  })
  .strict();

export const mobileVendorListQuerySchema = z.object({
  districtId: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminVendorListQuery = z.infer<typeof adminVendorListQuerySchema>;
export type CreateVendorBody = z.infer<typeof createVendorBodySchema>;
export type UpdateVendorBody = z.infer<typeof updateVendorBodySchema>;
export type VerifyVendorBody = z.infer<typeof verifyVendorBodySchema>;
export type MobileVendorListQuery = z.infer<typeof mobileVendorListQuerySchema>;
