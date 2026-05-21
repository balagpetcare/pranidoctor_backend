import {
  AnimalType,
  Prisma,
  ProviderStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { ListMobileProvidersQuery } from "./schemas";

const HOME_VISIT_CATEGORY_SLUGS = ["doctor-visit", "livestock-health-check"] as const;
const HOME_VISIT_SLUG_SET = new Set<string>(HOME_VISIT_CATEGORY_SLUGS);

const AVAILABILITY_PLACEHOLDER =
  "সময়সূচি শীঘ্রই যুক্ত হবে — যোগাযোগের মাধ্যমে নিশ্চিত করুন";

function decimalToString(d: unknown): string | null {
  if (d == null) return null;
  if (typeof (d as { toString?: () => string }).toString === "function") {
    return (d as { toString: () => string }).toString();
  }
  return String(d);
}

function categorySlugsForAnimalType(animalType: AnimalType): string[] {
  switch (animalType) {
    case AnimalType.CATTLE:
    case AnimalType.GOAT:
    case AnimalType.POULTRY:
      return [
        "livestock-health-check",
        "doctor-visit",
        "emergency",
        "emergency-visit",
        "vaccination",
      ];
    case AnimalType.DOG:
    case AnimalType.CAT:
      return [
        "doctor-visit",
        "general-consultation",
        "vaccination",
        "online-consultation",
      ];
    case AnimalType.OTHER:
    default:
      return [
        "doctor-visit",
        "general-consultation",
        "livestock-health-check",
      ];
  }
}

function metadataSearchPatternForAnimalType(
  animalType: AnimalType,
): string | null {
  switch (animalType) {
    case AnimalType.CATTLE:
      return "%cattle%";
    case AnimalType.GOAT:
      return "%goat%";
    case AnimalType.POULTRY:
      return "%poultry%";
    case AnimalType.DOG:
      return "%dog%";
    case AnimalType.CAT:
      return "%cat%";
    case AnimalType.OTHER:
    default:
      return null;
  }
}

async function getAreaSubtreeIds(rootId: string): Promise<string[]> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const batch = queue.splice(0, 40);
    const children = await prisma.area.findMany({
      where: {
        parentId: { in: batch },
        isActive: true,
      },
      select: { id: true },
    });
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return [...ids];
}

export async function resolveAreaIdsForQuery(
  query: ListMobileProvidersQuery,
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (!query.areaId && !query.areaSlug) {
    return { ok: true, ids: [] };
  }
  if (query.areaId) {
    const area = await prisma.area.findFirst({
      where: { id: query.areaId, isActive: true },
      select: { id: true },
    });
    if (!area) {
      return { ok: false, message: "Unknown or inactive areaId" };
    }
    const ids = await getAreaSubtreeIds(area.id);
    return { ok: true, ids };
  }
  const area = await prisma.area.findFirst({
    where: { slug: query.areaSlug!, isActive: true },
    select: { id: true },
  });
  if (!area) {
    return { ok: false, message: "Unknown or inactive areaSlug" };
  }
  const ids = await getAreaSubtreeIds(area.id);
  return { ok: true, ids };
}

async function technicianIdsMatchingAnimalMetadata(
  animalType: AnimalType,
): Promise<string[] | null> {
  const pattern = metadataSearchPatternForAnimalType(animalType);
  if (pattern == null) {
    return null;
  }
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "AiTechnicianProfile"
    WHERE "providerStatus" = 'ACTIVE'
      AND "metadataJson" IS NOT NULL
      AND CAST("metadataJson" AS TEXT) ILIKE ${pattern}
  `;
  return rows.map((r) => r.id);
}

const doctorListInclude = {
  doctorProfileAreas: {
    include: {
      area: {
        select: { id: true, name: true, nameBn: true, slug: true, type: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  doctorServiceAreas: {
    include: {
      village: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  doctorProfileServiceCategories: {
    include: {
      serviceCategory: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.DoctorProfileInclude;

type DoctorListRow = Prisma.DoctorProfileGetPayload<{
  include: typeof doctorListInclude;
}>;

const technicianListInclude = {
  aiTechnicianProfileAreas: {
    include: {
      area: {
        select: { id: true, name: true, nameBn: true, slug: true, type: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  aiTechnicianServiceAreas: {
    include: {
      village: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  aiTechnicianProfileServiceCategories: {
    include: {
      serviceCategory: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.AiTechnicianProfileInclude;

type TechnicianListRow = Prisma.AiTechnicianProfileGetPayload<{
  include: typeof technicianListInclude;
}>;

function formatAreaTextDoctor(row: DoctorListRow): string {
  const fromAreas = row.doctorProfileAreas
    .map((l) => l.area.nameBn?.trim() || l.area.name)
    .filter(Boolean);
  if (fromAreas.length > 0) {
    return fromAreas.join(", ");
  }
  const fromVillages = row.doctorServiceAreas
    .map((l) => l.village.name)
    .filter(Boolean);
  if (fromVillages.length > 0) {
    return fromVillages.join(", ");
  }
  return "এলাকা নির্ধারিত নয়";
}

function formatAreaTextTechnician(row: TechnicianListRow): string {
  const fromAreas = row.aiTechnicianProfileAreas
    .map((l) => l.area.nameBn?.trim() || l.area.name)
    .filter(Boolean);
  if (fromAreas.length > 0) {
    return fromAreas.join(", ");
  }
  const fromVillages = row.aiTechnicianServiceAreas
    .map((l) => l.village.name)
    .filter(Boolean);
  if (fromVillages.length > 0) {
    return fromVillages.join(", ");
  }
  return "এলাকা নির্ধারিত নয়";
}

function doctorHomeVisitCapable(row: DoctorListRow): boolean {
  if (row.visitFeeBdt != null) {
    return true;
  }
  return row.doctorProfileServiceCategories.some((l) =>
    HOME_VISIT_SLUG_SET.has(l.serviceCategory.slug),
  );
}

function technicianHomeVisitCapable(row: TechnicianListRow): boolean {
  if (row.serviceFeeBdt != null) {
    return true;
  }
  return row.aiTechnicianProfileServiceCategories.some(
    (l) => l.serviceCategory.slug === "ai-service",
  );
}

function supportedAnimalTypesFromMetadata(
  metadataJson: Prisma.JsonValue | null,
): string[] {
  if (metadataJson == null || typeof metadataJson !== "object") {
    return [];
  }
  const raw = (metadataJson as Record<string, unknown>).livestockFocus;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function serializeDoctorListItem(row: DoctorListRow) {
  const cats = row.doctorProfileServiceCategories.map((l) => l.serviceCategory);
  const primaryCat = cats[0];
  const degreeOrQualification =
    [row.degree?.trim(), row.specialization?.trim()].filter(Boolean).join(" · ") ||
    null;
  const serviceType =
    primaryCat?.name?.trim() ||
    row.specialization?.trim() ||
    "ভেটেরিনারিয়ান";

  return {
    id: row.id,
    name: row.displayName?.trim() || "ভেটেরিনারিয়ান",
    degreeOrQualification,
    serviceType,
    areaText: formatAreaTextDoctor(row),
    fee: decimalToString(row.visitFeeBdt),
    availability: AVAILABILITY_PLACEHOLDER,
    homeVisit: doctorHomeVisitCapable(row),
    emergency: row.acceptsEmergency,
    onlineConsultation: row.acceptsOnlineConsultation,
    phone: null as string | null,
    callAction: {
      enabled: false as const,
      phone: null as string | null,
      reason: "phone_not_exposed_yet",
    },
    bookAction: {
      enabled: false as const,
      providerId: row.id,
      kind: "doctor" as const,
      reason: "booking_flow_not_implemented",
    },
    rating: null as number | null,
    profilePhotoUrl: row.profilePhotoUrl?.trim() || null,
  };
}

function serializeTechnicianListItem(row: TechnicianListRow) {
  const cats = row.aiTechnicianProfileServiceCategories.map(
    (l) => l.serviceCategory,
  );
  const primaryCat = cats[0];
  const supportedAnimalTypes = supportedAnimalTypesFromMetadata(
    row.metadataJson,
  );
  const serviceType =
    primaryCat?.name?.trim() || "AI টেকনিশিয়ান / প্রজনন সেবা";

  return {
    id: row.id,
    name: row.displayName?.trim() || "AI টেকনিশিয়ান",
    serviceType,
    supportedAnimalTypes,
    areaText: formatAreaTextTechnician(row),
    fee: decimalToString(row.serviceFeeBdt),
    availability: AVAILABILITY_PLACEHOLDER,
    homeVisit: technicianHomeVisitCapable(row),
    emergency: row.acceptsEmergency,
    onlineConsultation: false,
    phone: null as string | null,
    callAction: {
      enabled: false as const,
      phone: null as string | null,
      reason: "phone_not_exposed_yet",
    },
    bookAction: {
      enabled: false as const,
      providerId: row.id,
      kind: "technician" as const,
      reason: "booking_flow_not_implemented",
    },
    rating: null as number | null,
  };
}

function paginationFromQuery(query: ListMobileProvidersQuery): {
  limit: number;
  offset: number;
} {
  const limit = query.limit ?? 20;
  let offset = query.offset ?? 0;
  if (query.page != null) {
    offset = (query.page - 1) * limit;
  }
  return { limit, offset };
}

function buildDoctorAndConditions(
  query: ListMobileProvidersQuery,
  areaIds: string[],
): Prisma.DoctorProfileWhereInput[] {
  const parts: Prisma.DoctorProfileWhereInput[] = [];

  if (query.emergency === true) {
    parts.push({ acceptsEmergency: true });
  }
  if (query.onlineConsultation === true) {
    parts.push({ acceptsOnlineConsultation: true });
  }

  if (query.homeVisit === true) {
    parts.push({
      OR: [
        { visitFeeBdt: { not: null } },
        {
          doctorProfileServiceCategories: {
            some: {
              serviceCategory: {
                slug: { in: [...HOME_VISIT_CATEGORY_SLUGS] },
              },
            },
          },
        },
      ],
    });
  } else if (query.homeVisit === false) {
    parts.push({
      AND: [
        { visitFeeBdt: null },
        {
          NOT: {
            doctorProfileServiceCategories: {
              some: {
                serviceCategory: {
                  slug: { in: [...HOME_VISIT_CATEGORY_SLUGS] },
                },
              },
            },
          },
        },
      ],
    });
  }

  if (query.serviceCategoryId) {
    parts.push({
      doctorProfileServiceCategories: {
        some: { serviceCategoryId: query.serviceCategoryId },
      },
    });
  }

  if (query.animalType) {
    const slugs = categorySlugsForAnimalType(query.animalType);
    parts.push({
      doctorProfileServiceCategories: {
        some: {
          serviceCategory: {
            slug: { in: slugs },
          },
        },
      },
    });
  }

  if (areaIds.length > 0) {
    parts.push({
      doctorProfileAreas: {
        some: { areaId: { in: areaIds } },
      },
    });
  }

  return parts;
}

function buildTechnicianAndConditions(
  query: ListMobileProvidersQuery,
  areaIds: string[],
  metadataMatchedIds: string[] | null,
): Prisma.AiTechnicianProfileWhereInput[] {
  const parts: Prisma.AiTechnicianProfileWhereInput[] = [];

  if (query.emergency === true) {
    parts.push({ acceptsEmergency: true });
  }

  if (query.homeVisit === true) {
    parts.push({
      OR: [
        { serviceFeeBdt: { not: null } },
        {
          aiTechnicianProfileServiceCategories: {
            some: { serviceCategory: { slug: "ai-service" } },
          },
        },
      ],
    });
  } else if (query.homeVisit === false) {
    parts.push({
      AND: [
        { serviceFeeBdt: null },
        {
          NOT: {
            aiTechnicianProfileServiceCategories: {
              some: { serviceCategory: { slug: "ai-service" } },
            },
          },
        },
      ],
    });
  }

  if (query.serviceCategoryId) {
    parts.push({
      aiTechnicianProfileServiceCategories: {
        some: { serviceCategoryId: query.serviceCategoryId },
      },
    });
  }

  if (metadataMatchedIds != null) {
    parts.push({ id: { in: metadataMatchedIds } });
  }

  if (areaIds.length > 0) {
    parts.push({
      aiTechnicianProfileAreas: {
        some: { areaId: { in: areaIds } },
      },
    });
  }

  return parts;
}

export async function listDoctorsForMobile(query: ListMobileProvidersQuery) {
  const area = await resolveAreaIdsForQuery(query);
  if (!area.ok) {
    return { error: area.message } as const;
  }

  const { limit, offset } = paginationFromQuery(query);
  const andParts = buildDoctorAndConditions(query, area.ids);

  const where: Prisma.DoctorProfileWhereInput = {
    providerStatus: ProviderStatus.ACTIVE,
    ...(andParts.length > 0 ? { AND: andParts } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.doctorProfile.count({ where }),
    prisma.doctorProfile.findMany({
      where,
      include: doctorListInclude,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    doctors: rows.map(serializeDoctorListItem),
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

export async function listTechniciansForMobile(
  query: ListMobileProvidersQuery,
) {
  if (query.onlineConsultation === true) {
    const { limit, offset } = paginationFromQuery(query);
    return {
      technicians: [] as ReturnType<typeof serializeTechnicianListItem>[],
      pagination: {
        limit,
        offset,
        total: 0,
        hasMore: false,
      },
    };
  }

  const area = await resolveAreaIdsForQuery(query);
  if (!area.ok) {
    return { error: area.message } as const;
  }

  let metadataIds: string[] | null = null;
  if (query.animalType) {
    const matched = await technicianIdsMatchingAnimalMetadata(query.animalType);
    if (matched === null) {
      metadataIds = null;
    } else if (matched.length === 0) {
      const { limit, offset } = paginationFromQuery(query);
      return {
        technicians: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false,
        },
      };
    } else {
      metadataIds = matched;
    }
  }

  const { limit, offset } = paginationFromQuery(query);
  const andParts = buildTechnicianAndConditions(
    query,
    area.ids,
    metadataIds,
  );

  const where: Prisma.AiTechnicianProfileWhereInput = {
    providerStatus: ProviderStatus.ACTIVE,
    ...(andParts.length > 0 ? { AND: andParts } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.aiTechnicianProfile.count({ where }),
    prisma.aiTechnicianProfile.findMany({
      where,
      include: technicianListInclude,
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    technicians: rows.map(serializeTechnicianListItem),
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + rows.length < total,
    },
  };
}

export async function getDoctorDetailForMobile(id: string) {
  const row = await prisma.doctorProfile.findFirst({
    where: { id, providerStatus: ProviderStatus.ACTIVE },
    include: doctorListInclude,
  });
  if (!row) {
    return null;
  }
  const base = serializeDoctorListItem(row);
  return {
    ...base,
    bio: row.bio,
    profilePhotoUrl: row.profilePhotoUrl,
    experienceYears: row.experienceYears,
    areas: row.doctorProfileAreas.map((l) => ({
      id: l.area.id,
      name: l.area.name,
      nameBn: l.area.nameBn,
      slug: l.area.slug,
      type: l.area.type,
      priority: l.priority,
    })),
    villages: row.doctorServiceAreas.map((l) => ({
      id: l.village.id,
      name: l.village.name,
      slug: l.village.slug,
      priority: l.priority,
    })),
    serviceCategories: row.doctorProfileServiceCategories.map((l) => ({
      id: l.serviceCategory.id,
      name: l.serviceCategory.name,
      slug: l.serviceCategory.slug,
    })),
  };
}

export async function getTechnicianDetailForMobile(id: string) {
  const row = await prisma.aiTechnicianProfile.findFirst({
    where: { id, providerStatus: ProviderStatus.ACTIVE },
    include: technicianListInclude,
  });
  if (!row) {
    return null;
  }
  const base = serializeTechnicianListItem(row);
  return {
    ...base,
    bio: row.bio,
    certification: row.certification,
    metadataJson: row.metadataJson,
    areas: row.aiTechnicianProfileAreas.map((l) => ({
      id: l.area.id,
      name: l.area.name,
      nameBn: l.area.nameBn,
      slug: l.area.slug,
      type: l.area.type,
      priority: l.priority,
    })),
    villages: row.aiTechnicianServiceAreas.map((l) => ({
      id: l.village.id,
      name: l.village.name,
      slug: l.village.slug,
      priority: l.priority,
    })),
    serviceCategories: row.aiTechnicianProfileServiceCategories.map((l) => ({
      id: l.serviceCategory.id,
      name: l.serviceCategory.name,
      slug: l.serviceCategory.slug,
    })),
  };
}
