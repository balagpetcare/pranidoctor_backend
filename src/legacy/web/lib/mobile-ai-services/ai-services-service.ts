import {
  AiServiceRecord,
  AiServiceRequestStatus,
  AiTechnicianReviewVisibility,
  AiTechnicianServiceStatus,
  AiTechnicianStatus,
  Prisma,
  ProviderStatus,
  ReviewStatus,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { aggregateStockForService } from "@/lib/mobile-ai-technician/semen-inventory-service";

import type {
  CreateAiServiceRequestBody,
  ListAiServiceTechniciansQuery,
  ListMyAiServiceRequestsQuery,
} from "./schemas";
import {
  mergeLegacyAndModuleRating,
  moduleReviewStatsForTechnicians,
} from "./ai-quality-service";

function parseEmergencyFlag(raw: string | undefined): boolean | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const s = raw.trim().toLowerCase();
  if (["1", "true", "yes"].includes(s)) return true;
  if (["0", "false", "no"].includes(s)) return false;
  return undefined;
}

function divisionAreaMatchWhere(
  district: string,
  upazila: string,
  unionOrArea?: string,
): Prisma.AiTechnicianDivisionServiceAreaWhereInput {
  const u = unionOrArea?.trim();
  const base: Prisma.AiTechnicianDivisionServiceAreaWhereInput = {
    isActive: true,
    district: { equals: district.trim(), mode: "insensitive" },
    upazila: { equals: upazila.trim(), mode: "insensitive" },
  };
  if (u) {
    return {
      ...base,
      OR: [
        { unionOrArea: null },
        { unionOrArea: { equals: u, mode: "insensitive" } },
        { unionOrArea: { contains: u, mode: "insensitive" } },
      ],
    };
  }
  return base;
}

function publishedTechnicianBaseWhere(): Prisma.AiTechnicianProfileWhereInput {
  return {
    status: AiTechnicianStatus.PUBLISHED,
    providerStatus: ProviderStatus.ACTIVE,
    user: { is: { status: UserStatus.ACTIVE } },
  };
}

const publicServiceInclude = {
  semenServiceTemplate: {
    include: {
      semenProvider: { select: { id: true, slug: true, name: true, nameBn: true } },
      breedMixes: {
        include: { breed: { select: { nameEn: true, nameBn: true } } },
      },
      media: { orderBy: { sortOrder: "asc" }, take: 8 },
    },
  },
} satisfies Prisma.AiTechnicianServiceInclude;

type PublicServiceRow = Prisma.AiTechnicianServiceGetPayload<{
  include: typeof publicServiceInclude;
}>;

async function serializePublicAiTechnicianServiceListing(s: PublicServiceRow) {
  const stockSummary = await aggregateStockForService(s.id);
  const base = {
    id: s.id,
    title: s.title,
    animalType: s.animalType,
    breedOrSemenType: s.breedOrSemenType,
    description: s.description,
    basePrice: s.basePrice.toString(),
    visitFee: s.visitFee?.toString() ?? null,
    emergencyFee: s.emergencyFee?.toString() ?? null,
    followUpIncluded: s.followUpIncluded,
    isAvailable: s.isAvailable,
    offerPrice: s.offerPrice?.toString() ?? null,
    discountPercent: s.discountPercent?.toString() ?? null,
    stockSummary,
    semenServiceTemplateId: s.semenServiceTemplateId,
  };
  if (s.semenServiceTemplate) {
    const t = s.semenServiceTemplate;
    return {
      ...base,
      semenTemplateLocked: {
        templateId: t.id,
        internalName: t.internalName,
        semenProductKind: t.semenProductKind,
        shortDescription: t.shortDescription,
        warningsContraindications: t.warningsContraindications,
        provider: t.semenProvider,
        breedMix: t.breedMixes.map((m) => ({
          percentage: m.percentage.toString(),
          nameEn: m.breed.nameEn,
          nameBn: m.breed.nameBn,
        })),
        media: t.media.map((m) => ({
          kind: m.kind,
          uploadedFileId: m.uploadedFileId,
          externalUrl: m.externalUrl,
        })),
      },
    };
  }
  return { ...base, semenTemplateLocked: null };
}

export async function ratingStatsForTechnicians(
  ids: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>();
  if (ids.length === 0) return map;
  const rows = await prisma.review.groupBy({
    by: ["aiTechnicianId"],
    where: {
      aiTechnicianId: { in: ids },
      status: ReviewStatus.APPROVED,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r.aiTechnicianId == null) continue;
    map.set(r.aiTechnicianId, {
      avg: r._avg.rating ?? 0,
      count: r._count._all,
    });
  }
  return map;
}

async function completedCountForTechnicians(
  ids: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (ids.length === 0) return map;
  const rows = await prisma.aiServiceRequest.groupBy({
    by: ["technicianProfileId"],
    where: {
      technicianProfileId: { in: ids },
      status: AiServiceRequestStatus.COMPLETED,
    },
    _count: { _all: true },
  });
  for (const r of rows) {
    if (r.technicianProfileId == null) continue;
    map.set(r.technicianProfileId, r._count._all);
  }
  return map;
}

export async function listAiServiceTechniciansPublic(
  query: ListAiServiceTechniciansQuery,
) {
  const emergency = parseEmergencyFlag(query.emergency);
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const serviceSome: Prisma.AiTechnicianServiceWhereInput = {
    status: AiTechnicianServiceStatus.ACTIVE,
    isAvailable: true,
    ...(query.animalType ? { animalType: query.animalType } : {}),
  };

  const divisionSome = divisionAreaMatchWhere(
    query.district,
    query.upazila,
    query.unionOrArea,
  );

  const where: Prisma.AiTechnicianProfileWhereInput = {
    AND: [
      publishedTechnicianBaseWhere(),
      {
        divisionCoverageAreas: { some: divisionSome },
      },
      {
        technicianServices: { some: serviceSome },
      },
      ...(emergency === true ? [{ acceptsEmergency: true }] : []),
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.aiTechnicianProfile.count({ where }),
    prisma.aiTechnicianProfile.findMany({
      where,
      include: {
        technicianServices: {
          where: serviceSome,
          orderBy: { basePrice: "asc" },
          include: {
            semenServiceTemplate: {
              include: {
                semenProvider: { select: { id: true, slug: true, name: true, nameBn: true } },
                breedMixes: {
                  include: { breed: { select: { nameEn: true, nameBn: true } } },
                },
                media: { orderBy: { sortOrder: "asc" }, take: 6 },
              },
            },
          },
        },
        divisionCoverageAreas: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  const ids = rows.map((r) => r.id);
  const [ratings, moduleRatings, completed] = await Promise.all([
    ratingStatsForTechnicians(ids),
    moduleReviewStatsForTechnicians(ids),
    completedCountForTechnicians(ids),
  ]);

  const dNorm = query.district.trim().toLowerCase();
  const uNorm = query.upazila.trim().toLowerCase();

  const technicians = await Promise.all(
    rows.map(async (row) => {
      const services = row.technicianServices;
      const prices = services.map((s) => Number(s.basePrice));
      const starting = prices.length ? Math.min(...prices) : null;
      const stat = mergeLegacyAndModuleRating(
        ratings.get(row.id),
        moduleRatings.get(row.id),
      );
      const matchingAreas = row.divisionCoverageAreas.filter(
        (a) =>
          a.district.trim().toLowerCase() === dNorm &&
          a.upazila.trim().toLowerCase() === uNorm,
      );
      const areaLines = matchingAreas.slice(0, 3).map(
        (a) =>
          `${a.district} · ${a.upazila}` +
          (a.unionOrArea?.trim() ? ` · ${a.unionOrArea.trim()}` : ""),
      );

      const serviceListings = await Promise.all(
        services.map((s) => serializePublicAiTechnicianServiceListing(s)),
      );

      return {
        id: row.id,
        displayName: row.displayName?.trim() || "এআই টেকনিশিয়ান",
        district: row.district,
        upazila: row.upazila,
        serviceAreaSummary:
          areaLines[0] ?? `${query.district.trim()} · ${query.upazila.trim()}`,
        verified: row.verifiedAt != null,
        acceptsEmergency: row.acceptsEmergency,
        startingPriceBdt: starting != null ? String(starting) : null,
        serviceTitles: services.map((s) => s.title),
        serviceListings,
        ratingAverage: stat.count > 0 ? stat.avg : null,
        ratingCount: stat.count,
        completedServicesCount: completed.get(row.id) ?? 0,
      };
    }),
  );

  return {
    technicians,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

export async function getAiServiceTechnicianPublic(id: string) {
  const where: Prisma.AiTechnicianProfileWhereInput = {
    id,
    AND: [
      publishedTechnicianBaseWhere(),
      {
        technicianServices: {
          some: {
            status: AiTechnicianServiceStatus.ACTIVE,
            isAvailable: true,
          },
        },
      },
    ],
  };

  const row = await prisma.aiTechnicianProfile.findFirst({
    where,
    include: {
      user: { select: { id: true } },
      technicianServices: {
        where: {
          status: AiTechnicianServiceStatus.ACTIVE,
          isAvailable: true,
        },
        orderBy: { updatedAt: "desc" },
        include: publicServiceInclude,
      },
      divisionCoverageAreas: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) {
    return { ok: "NOT_FOUND" as const };
  }

  const [ratingAgg, moduleAgg, completed] = await Promise.all([
    prisma.review.aggregate({
      where: {
        aiTechnicianId: row.id,
        status: ReviewStatus.APPROVED,
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.aiTechnicianReview.aggregate({
      where: {
        technicianProfileId: row.id,
        visibility: AiTechnicianReviewVisibility.VISIBLE,
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.aiServiceRequest.count({
      where: {
        technicianProfileId: row.id,
        status: AiServiceRequestStatus.COMPLETED,
      },
    }),
  ]);

  const merged = mergeLegacyAndModuleRating(
    ratingAgg._count._all > 0
      ? {
          avg: ratingAgg._avg.rating ?? 0,
          count: ratingAgg._count._all,
        }
      : undefined,
    moduleAgg._count._all > 0
      ? {
          avg: moduleAgg._avg.rating ?? 0,
          count: moduleAgg._count._all,
        }
      : undefined,
  );

  return {
    ok: true as const,
    technician: {
      id: row.id,
      displayName:
        row.displayName?.trim() || "এআই টেকনিশিয়ান",
      district: row.district,
      upazila: row.upazila,
      unionOrArea: row.unionOrArea,
      bio: row.bio,
      experienceYears: row.experienceYears,
      verified: row.verifiedAt != null,
      acceptsEmergency: row.acceptsEmergency,
      serviceFeeBdt: row.serviceFeeBdt?.toString() ?? null,
      completedServicesCount: completed,
      ratingAverage: merged.count > 0 ? merged.avg : null,
      ratingCount: merged.count,
      divisionCoverageAreas: row.divisionCoverageAreas.map(
        (a) => ({
          id: a.id,
          district: a.district,
          upazila: a.upazila,
          unionOrArea: a.unionOrArea,
        }),
      ),
      services: await Promise.all(
        row.technicianServices.map((s) => serializePublicAiTechnicianServiceListing(s)),
      ),
    },
  };
}

export async function technicianCoversRequestLocation(
  technicianProfileId: string,
  district: string,
  upazila: string,
  unionOrArea?: string | null,
): Promise<boolean> {
  const n = await prisma.aiTechnicianDivisionServiceArea.count({
    where: {
      aiTechnicianId: technicianProfileId,
      isActive: true,
      ...divisionAreaMatchWhere(district, upazila, unionOrArea ?? undefined),
    },
  });
  return n > 0;
}

function parseLastHeatDate(raw: string | null | undefined): Date | null {
  if (raw == null || raw.trim() === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mergeHealthNote(
  health: string | null | undefined,
  note: string | null | undefined,
): string | null {
  const h = health?.trim();
  const n = note?.trim();
  if (h && n) return `${h}\n\n${n}`;
  return h || n || null;
}

type AiRequestRow = Prisma.AiServiceRequestGetPayload<{
  include: {
    technicianProfile: { select: { id: true; displayName: true } };
  };
}>;

type AiServiceRecordRow = AiServiceRecord;

export function serializeAiServiceRecord(row: AiServiceRecordRow) {
  return {
    id: row.id,
    aiServiceRequestId: row.aiServiceRequestId,
    technicianProfileId: row.technicianProfileId,
    customerUserId: row.customerUserId,
    serviceDate: row.serviceDate.toISOString(),
    animalType: row.animalType,
    breedOrSemenType: row.breedOrSemenType,
    semenBatch: row.semenBatch,
    heatObservation: row.heatObservation,
    inseminationTime: row.inseminationTime?.toISOString() ?? null,
    serviceNote: row.serviceNote,
    nextFollowUpDate: row.nextFollowUpDate?.toISOString() ?? null,
    pregnancyCheckDate: row.pregnancyCheckDate?.toISOString() ?? null,
    totalFee: row.totalFee?.toString() ?? null,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAiServiceRequest(row: AiRequestRow) {
  return {
    id: row.id,
    status: row.status,
    animalType: row.animalType,
    breed: row.breed,
    animalAge: row.animalAge,
    lastHeatDate: row.lastHeatDate?.toISOString() ?? null,
    heatSymptoms: row.heatSymptoms,
    previousAiHistory: row.previousAiHistory,
    healthIssueNote: row.healthIssueNote,
    district: row.district,
    upazila: row.upazila,
    unionOrArea: row.unionOrArea,
    addressDetail: row.addressDetail,
    preferredTime: row.preferredTime,
    isEmergency: row.isEmergency,
    technicianProfileId: row.technicianProfileId,
    serviceId: row.serviceId,
    estimatedFee: row.estimatedFee?.toString() ?? null,
    finalFee: row.finalFee?.toString() ?? null,
    paymentStatus: row.paymentStatus,
    declineReason: row.declineReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    technicianDisplayName: row.technicianProfile?.displayName ?? null,
  };
}

export async function createAiServiceRequestForCustomer(
  customerUserId: string,
  body: CreateAiServiceRequestBody,
) {
  let technicianProfileId = body.technicianProfileId?.trim() || null;
  const serviceId = body.serviceId?.trim() || null;

  if (serviceId) {
    const svc = await prisma.aiTechnicianService.findFirst({
      where: {
        id: serviceId,
        status: AiTechnicianServiceStatus.ACTIVE,
        isAvailable: true,
      },
      select: { id: true, aiTechnicianId: true, animalType: true },
    });
    if (!svc) {
      return { ok: "NOT_FOUND_SERVICE" as const };
    }
    if (technicianProfileId && technicianProfileId !== svc.aiTechnicianId) {
      return { ok: "SERVICE_TECH_MISMATCH" as const };
    }
    technicianProfileId = svc.aiTechnicianId;
    if (svc.animalType !== body.animalType) {
      return { ok: "ANIMAL_TYPE_MISMATCH" as const };
    }
  }

  if (technicianProfileId) {
    const tech = await prisma.aiTechnicianProfile.findFirst({
      where: {
        id: technicianProfileId,
        ...publishedTechnicianBaseWhere(),
      },
      select: { id: true },
    });
    if (!tech) {
      return { ok: "NOT_FOUND_TECHNICIAN" as const };
    }
    const covers = await technicianCoversRequestLocation(
      technicianProfileId,
      body.district,
      body.upazila,
      body.unionOrArea,
    );
    if (!covers) {
      return { ok: "AREA_MISMATCH" as const };
    }
  }

  const lastHeat = parseLastHeatDate(body.lastHeatDate ?? undefined);
  const healthNote = mergeHealthNote(body.healthIssueNote, body.note);

  let estimatedFee: Prisma.Decimal | null = null;
  if (serviceId) {
    const full = await prisma.aiTechnicianService.findUnique({
      where: { id: serviceId },
      select: { basePrice: true, visitFee: true },
    });
    if (full) {
      let sum = new Prisma.Decimal(full.basePrice.toString());
      if (full.visitFee != null) {
        sum = sum.plus(new Prisma.Decimal(full.visitFee.toString()));
      }
      estimatedFee = sum;
    }
  }

  const created = await prisma.aiServiceRequest.create({
    data: {
      customerUserId,
      technicianProfileId,
      serviceId,
      animalType: body.animalType,
      breed: body.breed?.trim() || null,
      animalAge: body.animalAge?.trim() || null,
      lastHeatDate: lastHeat,
      heatSymptoms: body.heatSymptoms?.trim() || null,
      previousAiHistory: body.previousAiHistory?.trim() || null,
      healthIssueNote: healthNote,
      district: body.district.trim(),
      upazila: body.upazila.trim(),
      unionOrArea: body.unionOrArea?.trim() || null,
      addressDetail: body.addressDetail.trim(),
      preferredTime: body.preferredTime?.trim() || null,
      isEmergency: body.isEmergency ?? false,
      status: AiServiceRequestStatus.PENDING,
      ...(estimatedFee != null ? { estimatedFee } : {}),
    },
    include: {
      technicianProfile: { select: { id: true, displayName: true } },
    },
  });

  return { ok: true as const, request: serializeAiServiceRequest(created) };
}

const requestListInclude = {
  technicianProfile: {
    select: { id: true, displayName: true },
  },
} satisfies Prisma.AiServiceRequestInclude;

export async function listMyAiServiceRequests(
  customerUserId: string,
  query: ListMyAiServiceRequestsQuery,
) {
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  const where: Prisma.AiServiceRequestWhereInput = {
    customerUserId,
  };

  const [total, rows] = await Promise.all([
    prisma.aiServiceRequest.count({ where }),
    prisma.aiServiceRequest.findMany({
      where,
      include: requestListInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    requests: rows.map(serializeAiServiceRequest),
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

export async function getMyAiServiceRequestById(
  customerUserId: string,
  id: string,
) {
  const row = await prisma.aiServiceRequest.findFirst({
    where: { id, customerUserId },
    include: {
      ...requestListInclude,
      aiTechnicianReview: { select: { id: true } },
    },
  });
  if (!row) return null;
  const base = serializeAiServiceRequest(row);
  return {
    ...base,
    hasAiReview: row.aiTechnicianReview != null,
  };
}
