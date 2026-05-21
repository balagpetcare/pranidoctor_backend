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

export const createTechnicianBodySchema = z.object({
  email: z.string().trim().email(),
  phone: phoneSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(200),
  certification: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(8000).optional(),
  serviceFeeBdt: z.number().nonnegative().optional(),
  acceptsEmergency: z.boolean().optional(),
  metadataJson: z.record(z.string(), z.any()).optional(),
  initialAreaIds: z.array(z.string().min(1).max(40)).max(500).optional(),
  initialVillageIds: z.array(z.string().min(1).max(40)).max(500).optional(),
  initialServiceCategoryIds: z
    .array(z.string().min(1).max(40))
    .max(100)
    .optional(),
});

export const patchTechnicianBodySchema = z
  .object({
    email: z.string().trim().email().optional(),
    phone: phoneSchema.nullable().optional(),
    displayName: z.string().trim().min(1).max(200).nullable().optional(),
    certification: z.string().trim().min(1).max(120).nullable().optional(),
    bio: z.string().trim().max(8000).nullable().optional(),
    serviceFeeBdt: z.number().nonnegative().nullable().optional(),
    acceptsEmergency: z.boolean().optional(),
    metadataJson: z.record(z.string(), z.any()).nullable().optional(),
    userStatus: userStatusSchema.optional(),
  })
  .strict();

export const listTechniciansQuerySchema = z.object({
  q: z.string().trim().optional(),
  providerStatus: providerStatusSchema.optional(),
  userStatus: userStatusSchema.optional(),
  areaId: z.string().min(1).max(40).optional(),
  villageId: z.string().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const workingAreasBodySchema = z
  .object({
    areaIds: z.array(z.string().min(1).max(40)).max(500),
  })
  .strict();

export const villageServiceAreasBodySchema = z
  .object({
    villageIds: z.array(z.string().min(1).max(40)).max(500),
  })
  .strict();

export const serviceCategoriesBodySchema = z
  .object({
    serviceCategoryIds: z.array(z.string().min(1).max(40)).max(100),
  })
  .strict();

export const serviceFeeBodySchema = z
  .object({
    serviceFeeBdt: z.union([
      z.number().nonnegative(),
      z.string().trim(),
      z.null(),
    ]),
  })
  .strict();

export function parseServiceFeeInput(
  raw: z.infer<typeof serviceFeeBodySchema>,
): Prisma.Decimal | null {
  const v = raw.serviceFeeBdt;
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
