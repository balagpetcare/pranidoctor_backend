import { z } from "zod";

import {
  Prisma,
  ProviderStatus,
  UserStatus,
} from "@/generated/prisma/client";

const providerStatusValues = [
  ProviderStatus.PENDING_VERIFICATION,
  ProviderStatus.ACTIVE,
  ProviderStatus.SUSPENDED,
  ProviderStatus.REJECTED,
] as const;

const userStatusValues = [
  UserStatus.ACTIVE,
  UserStatus.SUSPENDED,
  UserStatus.PENDING_VERIFICATION,
  UserStatus.INVITED,
  UserStatus.DELETED,
] as const;

export const providerStatusSchema = z.enum(providerStatusValues);
export const userStatusSchema = z.enum(userStatusValues);

const phoneSchema = z
  .string()
  .trim()
  .min(10, "Phone is required (min 10 characters)")
  .max(32);

const optionalUrlOrPath = z
  .union([
    z.string().trim().max(2000),
    z.literal(""),
  ])
  .optional();

export const createDoctorBodySchema = z.object({
  email: z.string().trim().email(),
  phone: phoneSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(200),
  licenseNumber: z.string().trim().min(1).max(120),
  degree: z.string().trim().max(200).optional(),
  specialization: z.string().trim().max(500).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  bio: z.string().trim().max(8000).optional(),
  profilePhotoUrl: optionalUrlOrPath,
  visitFeeBdt: z.number().nonnegative().optional(),
  acceptsEmergency: z.boolean().optional(),
  acceptsOnlineConsultation: z.boolean().optional(),
});

export const patchDoctorBodySchema = z
  .object({
    email: z.string().trim().email().optional(),
    phone: phoneSchema.nullable().optional(),
    displayName: z.string().trim().min(1).max(200).nullable().optional(),
    licenseNumber: z.string().trim().min(1).max(120).optional(),
    degree: z.string().trim().max(200).nullable().optional(),
    specialization: z.string().trim().max(500).nullable().optional(),
    experienceYears: z.number().int().min(0).max(80).nullable().optional(),
    bio: z.string().trim().max(8000).nullable().optional(),
    profilePhotoUrl: z.union([z.string().trim().max(2000), z.literal("")]).nullable().optional(),
    visitFeeBdt: z.number().nonnegative().nullable().optional(),
    acceptsEmergency: z.boolean().optional(),
    acceptsOnlineConsultation: z.boolean().optional(),
  })
  .strict();

export const listDoctorsQuerySchema = z.object({
  q: z.string().trim().optional(),
  providerStatus: providerStatusSchema.optional(),
  userStatus: userStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const workingAreasBodySchema = z
  .object({
    areaIds: z.array(z.string().min(1).max(40)).max(500),
  })
  .strict();

export const serviceCategoriesBodySchema = z
  .object({
    serviceCategoryIds: z.array(z.string().min(1).max(40)).max(100),
  })
  .strict();

export const visitFeeBodySchema = z
  .object({
    visitFeeBdt: z.union([
      z.number().nonnegative(),
      z.string().trim(),
      z.null(),
    ]),
  })
  .strict();

export function parseVisitFeeInput(
  raw: z.infer<typeof visitFeeBodySchema>,
): Prisma.Decimal | null {
  const v = raw.visitFeeBdt;
  if (v === null) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0) throw new Error("INVALID_FEE");
    return new Prisma.Decimal(v);
  }
  const s = v.trim();
  if (s === "") return null;
  if (!/^\d+(\.\d{1,4})?$/.test(s)) throw new Error("INVALID_FEE");
  return new Prisma.Decimal(s);
}

export const availabilityBodySchema = z
  .object({
    acceptsEmergency: z.boolean(),
  })
  .strict();

export const onlineConsultationBodySchema = z
  .object({
    acceptsOnlineConsultation: z.boolean(),
  })
  .strict();
