import {
  AiTechnicianServiceStatus,
  AiTechnicianStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { resolveServicePricing, type PricingErrorCode } from "./ai-service-pricing";
import { aggregateStockForService } from "./semen-inventory-service";
import type {
  CreateAiTechnicianServiceBody,
  PatchAiTechnicianServiceBody,
  PatchTemplateBackedAiTechnicianServiceBody,
} from "./technician-services-schemas";
import {
  patchAiTechnicianServiceBodySchema,
  patchTemplateBackedAiTechnicianServiceBodySchema,
} from "./technician-services-schemas";

function toDecimal(v: number | string): Prisma.Decimal {
  const s = typeof v === "number" ? String(v) : v.trim();
  return new Prisma.Decimal(s);
}

async function getTechnicianProfileIdForUser(userId: string) {
  return prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
    },
  });
}

export function canManageTechnicianServices(status: AiTechnicianStatus): boolean {
  return status === AiTechnicianStatus.APPROVED || status === AiTechnicianStatus.PUBLISHED;
}

const serviceForMobileInclude = {
  semenServiceTemplate: {
    include: {
      semenProvider: true,
      breedMixes: { include: { breed: true }, orderBy: { id: "asc" } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  },
  semenInventoryLots: true,
} satisfies Prisma.AiTechnicianServiceInclude;

export type AiTechnicianServiceMobileRow = Prisma.AiTechnicianServiceGetPayload<{
  include: typeof serviceForMobileInclude;
}>;

function serializeLockedTemplate(t: NonNullable<AiTechnicianServiceMobileRow["semenServiceTemplate"]>) {
  return {
    id: t.id,
    internalName: t.internalName,
    animalType: t.animalType,
    semenProductKind: t.semenProductKind,
    otherSemenLabel: t.otherSemenLabel,
    shortDescription: t.shortDescription,
    detailedDescription: t.detailedDescription,
    expectedBenefits: t.expectedBenefits,
    recommendedAnimalCondition: t.recommendedAnimalCondition,
    warningsContraindications: t.warningsContraindications,
    defaultBasePrice: t.defaultBasePrice.toString(),
    defaultOfferPrice: t.defaultOfferPrice?.toString() ?? null,
    defaultDiscountPercent: t.defaultDiscountPercent?.toString() ?? null,
    tagsJson: t.tagsJson,
    semenProvider: {
      id: t.semenProvider.id,
      slug: t.semenProvider.slug,
      name: t.semenProvider.name,
      nameBn: t.semenProvider.nameBn,
    },
    breedMix: t.breedMixes.map((m) => ({
      breedId: m.breedId,
      percentage: m.percentage.toString(),
      breed: {
        id: m.breed.id,
        slug: m.breed.slug,
        nameEn: m.breed.nameEn,
        nameBn: m.breed.nameBn,
        animalType: m.breed.animalType,
      },
    })),
    media: t.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      uploadedFileId: m.uploadedFileId,
      externalUrl: m.externalUrl,
      sortOrder: m.sortOrder,
    })),
  };
}

export async function serializeAiTechnicianServiceForMobile(row: AiTechnicianServiceMobileRow) {
  const stockSummary = await aggregateStockForService(row.id);
  const base: Record<string, unknown> = {
    id: row.id,
    aiTechnicianId: row.aiTechnicianId,
    title: row.title,
    animalType: row.animalType,
    breedOrSemenType: row.breedOrSemenType,
    description: row.description,
    basePrice: row.basePrice.toString(),
    /** Technician-entered split (null for services created with a single price). */
    semenPrice: row.semenPrice?.toString() ?? null,
    aiServiceCharge: row.aiServiceCharge?.toString() ?? null,
    /** Customer price before any offer / discount (= semenPrice + aiServiceCharge when split is used). */
    totalCustomerPrice: row.basePrice.toString(),
    visitFee: row.visitFee?.toString() ?? null,
    emergencyFee: row.emergencyFee?.toString() ?? null,
    repeatServicePolicy: row.repeatServicePolicy,
    followUpIncluded: row.followUpIncluded,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    semenServiceTemplateId: row.semenServiceTemplateId,
    offerPrice: row.offerPrice?.toString() ?? null,
    discountPercent: row.discountPercent?.toString() ?? null,
    isAvailable: row.isAvailable,
    technicianServiceNote: row.technicianServiceNote,
    stockSummary,
  };
  if (row.semenServiceTemplateId && row.semenServiceTemplate) {
    base.semenTemplateLocked = serializeLockedTemplate(row.semenServiceTemplate);
  } else {
    base.semenTemplateLocked = null;
  }
  return base;
}

export async function listTechnicianServicesForMobileUser(userId: string) {
  const profile = await getTechnicianProfileIdForUser(userId);
  if (!profile) {
    return { ok: true as const, services: [] };
  }
  const rows = await prisma.aiTechnicianService.findMany({
    where: { aiTechnicianId: profile.id },
    orderBy: [{ updatedAt: "desc" }],
    include: serviceForMobileInclude,
  });
  const services = await Promise.all(rows.map(serializeAiTechnicianServiceForMobile));
  return { ok: true as const, services };
}

export async function createTechnicianServiceForMobileUser(
  userId: string,
  body: CreateAiTechnicianServiceBody,
) {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) {
    return { ok: "NO_PROFILE" as const };
  }
  if (!canManageTechnicianServices(profile.status)) {
    return { ok: "NOT_ALLOWED" as const, status: profile.status };
  }

  const pricing = resolveServicePricing({
    basePrice: body.basePrice,
    semenPrice: body.semenPrice,
    aiServiceCharge: body.aiServiceCharge,
  });
  if (!pricing.ok) {
    return { ok: "PRICING_ERROR" as const, code: pricing.code };
  }

  const created = await prisma.aiTechnicianService.create({
    data: {
      aiTechnicianId: profile.id,
      title: body.title.trim(),
      animalType: body.animalType,
      breedOrSemenType: body.breedOrSemenType?.trim() || null,
      description: body.description?.trim() || null,
      basePrice: toDecimal(pricing.basePrice),
      semenPrice: pricing.semenPrice === null ? null : toDecimal(pricing.semenPrice),
      aiServiceCharge:
        pricing.aiServiceCharge === null ? null : toDecimal(pricing.aiServiceCharge),
      visitFee:
        body.visitFee === undefined || body.visitFee === null
          ? null
          : toDecimal(body.visitFee),
      emergencyFee:
        body.emergencyFee === undefined || body.emergencyFee === null
          ? null
          : toDecimal(body.emergencyFee),
      repeatServicePolicy: body.repeatServicePolicy?.trim() || null,
      followUpIncluded: body.followUpIncluded ?? false,
      status: AiTechnicianServiceStatus.DRAFT,
    },
  });

  const full = await prisma.aiTechnicianService.findUniqueOrThrow({
    where: { id: created.id },
    include: serviceForMobileInclude,
  });
  return { ok: true as const, service: await serializeAiTechnicianServiceForMobile(full) };
}

type PricePatchInput = {
  basePrice?: number | string;
  semenPrice?: number | string | null;
  aiServiceCharge?: number | string | null;
};

/**
 * Computes the price columns to write for a PATCH.
 *  - semenPrice / aiServiceCharge given: merged with the stored value of the other one, and
 *    `basePrice` is re-derived as their sum (an explicit, different `basePrice` is rejected).
 *  - only `basePrice` given: stored as is and any previous split is cleared, so a split can
 *    never disagree with `basePrice` (keeps older clients that only know `basePrice` working).
 */
function resolvePricePatch(
  existing: { semenPrice: Prisma.Decimal | null; aiServiceCharge: Prisma.Decimal | null },
  p: PricePatchInput,
):
  | { ok: true; data: Prisma.AiTechnicianServiceUpdateInput }
  | { ok: false; code: PricingErrorCode } {
  const touchesSplit = p.semenPrice !== undefined || p.aiServiceCharge !== undefined;
  if (!touchesSplit) {
    if (p.basePrice === undefined) return { ok: true, data: {} };
    const only = resolveServicePricing({ basePrice: p.basePrice });
    if (!only.ok) return only;
    return {
      ok: true,
      data: { basePrice: toDecimal(only.basePrice), semenPrice: null, aiServiceCharge: null },
    };
  }

  const semenRaw = p.semenPrice !== undefined ? p.semenPrice : existing.semenPrice?.toString();
  const chargeRaw =
    p.aiServiceCharge !== undefined ? p.aiServiceCharge : existing.aiServiceCharge?.toString();
  const blank = (v: unknown) => v == null || String(v).trim() === "";

  // Both cleared: drop the split and keep the (optionally updated) single customer price.
  if (blank(semenRaw) && blank(chargeRaw)) {
    if (p.basePrice === undefined) {
      return { ok: true, data: { semenPrice: null, aiServiceCharge: null } };
    }
    const only = resolveServicePricing({ basePrice: p.basePrice });
    if (!only.ok) return only;
    return {
      ok: true,
      data: { basePrice: toDecimal(only.basePrice), semenPrice: null, aiServiceCharge: null },
    };
  }

  const resolved = resolveServicePricing({
    basePrice: p.basePrice,
    semenPrice: semenRaw,
    aiServiceCharge: chargeRaw,
  });
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    data: {
      basePrice: toDecimal(resolved.basePrice),
      semenPrice: resolved.semenPrice === null ? null : toDecimal(resolved.semenPrice),
      aiServiceCharge:
        resolved.aiServiceCharge === null ? null : toDecimal(resolved.aiServiceCharge),
    },
  };
}

export type PatchTechnicianServiceResult =
  | { ok: true; service: Awaited<ReturnType<typeof serializeAiTechnicianServiceForMobile>> }
  | { ok: "NO_PROFILE" }
  | { ok: "NOT_ALLOWED"; status: AiTechnicianStatus }
  | { ok: "NOT_FOUND" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianServiceStatus }
  | { ok: "PRICING_ERROR"; code: PricingErrorCode }
  | { ok: "VALIDATION_ERROR"; issues: unknown };

export async function patchTechnicianServiceForMobileUser(
  userId: string,
  serviceId: string,
  body: unknown,
): Promise<PatchTechnicianServiceResult> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) {
    return { ok: "NO_PROFILE" };
  }
  if (!canManageTechnicianServices(profile.status)) {
    return { ok: "NOT_ALLOWED", status: profile.status };
  }

  const existing = await prisma.aiTechnicianService.findFirst({
    where: { id: serviceId, aiTechnicianId: profile.id },
    include: serviceForMobileInclude,
  });
  if (!existing) {
    return { ok: "NOT_FOUND" };
  }

  if (existing.semenServiceTemplateId) {
    if (existing.status === AiTechnicianServiceStatus.REJECTED) {
      return { ok: "NOT_EDITABLE", status: existing.status };
    }

    const parsed = patchTemplateBackedAiTechnicianServiceBodySchema.safeParse(body);
    if (!parsed.success) {
      return { ok: "VALIDATION_ERROR", issues: parsed.error.flatten() };
    }
    const p = parsed.data as PatchTemplateBackedAiTechnicianServiceBody;
    const data: Prisma.AiTechnicianServiceUpdateInput = {};
    const priceChange = resolvePricePatch(existing, p);
    if (!priceChange.ok) return { ok: "PRICING_ERROR", code: priceChange.code };
    Object.assign(data, priceChange.data);
    if (p.visitFee !== undefined) {
      data.visitFee = p.visitFee === null ? null : toDecimal(p.visitFee);
    }
    if (p.emergencyFee !== undefined) {
      data.emergencyFee = p.emergencyFee === null ? null : toDecimal(p.emergencyFee);
    }
    if (p.offerPrice !== undefined) {
      data.offerPrice = p.offerPrice === null ? null : toDecimal(p.offerPrice);
    }
    if (p.discountPercent !== undefined) {
      data.discountPercent = p.discountPercent === null ? null : toDecimal(p.discountPercent);
    }
    if (p.isAvailable !== undefined) data.isAvailable = p.isAvailable;
    if (p.technicianServiceNote !== undefined) {
      data.technicianServiceNote = p.technicianServiceNote?.trim() || null;
    }
    if (p.repeatServicePolicy !== undefined) {
      data.repeatServicePolicy = p.repeatServicePolicy?.trim() || null;
    }
    if (p.followUpIncluded !== undefined) data.followUpIncluded = p.followUpIncluded;

    if (Object.keys(data).length === 0) {
      return { ok: true, service: await serializeAiTechnicianServiceForMobile(existing) };
    }

    const updated = await prisma.aiTechnicianService.update({
      where: { id: serviceId },
      data,
      include: serviceForMobileInclude,
    });
    return { ok: true, service: await serializeAiTechnicianServiceForMobile(updated) };
  }

  if (
    existing.status === AiTechnicianServiceStatus.ACTIVE ||
    existing.status === AiTechnicianServiceStatus.REJECTED ||
    existing.status === AiTechnicianServiceStatus.INACTIVE
  ) {
    return { ok: "NOT_EDITABLE", status: existing.status };
  }

  const parsed = patchAiTechnicianServiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: "VALIDATION_ERROR", issues: parsed.error.flatten() };
  }
  const b = parsed.data as PatchAiTechnicianServiceBody;

  const data: Prisma.AiTechnicianServiceUpdateInput = {};
  if (b.title !== undefined) data.title = b.title.trim();
  if (b.animalType !== undefined) data.animalType = b.animalType;
  if (b.breedOrSemenType !== undefined) {
    data.breedOrSemenType = b.breedOrSemenType?.trim() || null;
  }
  if (b.description !== undefined) {
    data.description = b.description?.trim() || null;
  }
  const manualPrice = resolvePricePatch(existing, b);
  if (!manualPrice.ok) return { ok: "PRICING_ERROR", code: manualPrice.code };
  Object.assign(data, manualPrice.data);
  if (b.visitFee !== undefined) {
    data.visitFee = b.visitFee === null ? null : toDecimal(b.visitFee);
  }
  if (b.emergencyFee !== undefined) {
    data.emergencyFee = b.emergencyFee === null ? null : toDecimal(b.emergencyFee);
  }
  if (b.repeatServicePolicy !== undefined) {
    data.repeatServicePolicy = b.repeatServicePolicy?.trim() || null;
  }
  if (b.followUpIncluded !== undefined) {
    data.followUpIncluded = b.followUpIncluded;
  }

  if (Object.keys(data).length === 0) {
    return { ok: true, service: await serializeAiTechnicianServiceForMobile(existing) };
  }

  const updated = await prisma.aiTechnicianService.update({
    where: { id: serviceId },
    data,
    include: serviceForMobileInclude,
  });

  return { ok: true, service: await serializeAiTechnicianServiceForMobile(updated) };
}

export async function deactivateTechnicianServiceForMobileUser(
  userId: string,
  serviceId: string,
) {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) {
    return { ok: "NO_PROFILE" as const };
  }
  if (!canManageTechnicianServices(profile.status)) {
    return { ok: "NOT_ALLOWED" as const, status: profile.status };
  }

  const existing = await prisma.aiTechnicianService.findFirst({
    where: { id: serviceId, aiTechnicianId: profile.id },
    include: serviceForMobileInclude,
  });
  if (!existing) {
    return { ok: "NOT_FOUND" as const };
  }

  if (existing.status === AiTechnicianServiceStatus.INACTIVE) {
    return {
      ok: true as const,
      service: await serializeAiTechnicianServiceForMobile(existing),
    };
  }

  const updated = await prisma.aiTechnicianService.update({
    where: { id: serviceId },
    data: { status: AiTechnicianServiceStatus.INACTIVE },
    include: serviceForMobileInclude,
  });

  return {
    ok: true as const,
    service: await serializeAiTechnicianServiceForMobile(updated),
  };
}

export async function patchTechnicianSettingsForMobileUser(
  userId: string,
  acceptsEmergency: boolean,
) {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) {
    return { ok: "NO_PROFILE" as const };
  }
  if (profile.status !== AiTechnicianStatus.PUBLISHED) {
    return { ok: "NOT_PUBLISHED" as const };
  }

  await prisma.aiTechnicianProfile.update({
    where: { id: profile.id },
    data: { acceptsEmergency },
  });

  return { ok: true as const };
}
