/**
 * Idempotent upserts for location rows protected by partial unique indexes on
 * TRIM(code) (see migration `20260511133000_location_dedupe_unique_constraints`).
 * Prisma `upsert({ where: { slug } })` does not consider expression indexes; a create
 * can still violate (divisionId, TRIM(code)) when another row already matches trimmed code.
 *
 * Order of resolution: match by **slug** first (stable identity), else by **trim(code)**
 * under the parent, else **create**. Updates preserve row `id`.
 */
import type { PrismaClient } from "../../src/generated/prisma/client";

async function findDistrictIdByTrimmedCode(
  prisma: PrismaClient,
  divisionId: string,
  normalizedCode: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "District"
    WHERE "divisionId" = ${divisionId}
      AND "code" IS NOT NULL
      AND TRIM(BOTH FROM "code") = ${normalizedCode}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function findUpazilaIdByTrimmedCode(
  prisma: PrismaClient,
  districtId: string,
  normalizedCode: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Upazila"
    WHERE "districtId" = ${districtId}
      AND "code" IS NOT NULL
      AND TRIM(BOTH FROM "code") = ${normalizedCode}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function findUnionIdByTrimmedCode(
  prisma: PrismaClient,
  upazilaId: string,
  normalizedCode: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Union"
    WHERE "upazilaId" = ${upazilaId}
      AND "code" IS NOT NULL
      AND TRIM(BOTH FROM "code") = ${normalizedCode}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function findVillageIdByTrimmedCode(
  prisma: PrismaClient,
  unionId: string,
  normalizedCode: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Village"
    WHERE "unionId" = ${unionId}
      AND "code" IS NOT NULL
      AND TRIM(BOTH FROM "code") = ${normalizedCode}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export type UpsertDistrictByTrimmedCodeArgs = {
  divisionId: string;
  code: string | null | undefined;
  slug: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  source?: string | null;
  isVerified?: boolean;
};

export async function upsertDistrictByTrimmedCode(
  prisma: PrismaClient,
  args: UpsertDistrictByTrimmedCodeArgs,
) {
  const norm = args.code?.trim() ?? "";
  const hasSignificantCode = norm !== "";

  const bySlug = await prisma.district.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  });

  const dataCommon = {
    divisionId: args.divisionId,
    name: args.name,
    ...(args.nameBn !== undefined ? { nameBn: args.nameBn } : {}),
    ...(args.nameEn !== undefined ? { nameEn: args.nameEn } : {}),
    ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
    ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
  };

  if (bySlug) {
    return prisma.district.update({
      where: { id: bySlug.id },
      data: {
        ...dataCommon,
        code: hasSignificantCode ? norm : args.code ?? null,
      },
    });
  }

  if (hasSignificantCode) {
    const trimId = await findDistrictIdByTrimmedCode(prisma, args.divisionId, norm);
    if (trimId) {
      return prisma.district.update({
        where: { id: trimId },
        data: {
          slug: args.slug,
          ...dataCommon,
          code: norm,
        },
      });
    }
  }

  return prisma.district.create({
    data: {
      divisionId: args.divisionId,
      slug: args.slug,
      name: args.name,
      nameBn: args.nameBn ?? null,
      nameEn: args.nameEn ?? null,
      code: hasSignificantCode ? norm : args.code?.trim() || null,
      sortOrder: args.sortOrder ?? 0,
      isActive: args.isActive ?? true,
      ...(args.source !== undefined ? { source: args.source } : {}),
      ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
    },
  });
}

export type UpsertUpazilaByTrimmedCodeArgs = {
  districtId: string;
  code: string | null | undefined;
  slug: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  source?: string | null;
  isVerified?: boolean;
};

export async function upsertUpazilaByTrimmedCode(
  prisma: PrismaClient,
  args: UpsertUpazilaByTrimmedCodeArgs,
) {
  const norm = args.code?.trim() ?? "";
  const hasSignificantCode = norm !== "";

  const bySlug = await prisma.upazila.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  });

  const dataCommon = {
    districtId: args.districtId,
    name: args.name,
    ...(args.nameBn !== undefined ? { nameBn: args.nameBn } : {}),
    ...(args.nameEn !== undefined ? { nameEn: args.nameEn } : {}),
    ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
    ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
  };

  if (bySlug) {
    return prisma.upazila.update({
      where: { id: bySlug.id },
      data: {
        ...dataCommon,
        code: hasSignificantCode ? norm : args.code ?? null,
      },
    });
  }

  if (hasSignificantCode) {
    const trimId = await findUpazilaIdByTrimmedCode(prisma, args.districtId, norm);
    if (trimId) {
      return prisma.upazila.update({
        where: { id: trimId },
        data: {
          slug: args.slug,
          ...dataCommon,
          code: norm,
        },
      });
    }
  }

  return prisma.upazila.create({
    data: {
      districtId: args.districtId,
      slug: args.slug,
      name: args.name,
      nameBn: args.nameBn ?? null,
      nameEn: args.nameEn ?? null,
      code: hasSignificantCode ? norm : args.code?.trim() || null,
      sortOrder: args.sortOrder ?? 0,
      isActive: args.isActive ?? true,
      ...(args.source !== undefined ? { source: args.source } : {}),
      ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
    },
  });
}

export type UpsertUnionByTrimmedCodeArgs = {
  upazilaId: string;
  code: string | null | undefined;
  slug: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  source?: string | null;
  isVerified?: boolean;
};

export async function upsertUnionByTrimmedCode(
  prisma: PrismaClient,
  args: UpsertUnionByTrimmedCodeArgs,
) {
  const norm = args.code?.trim() ?? "";
  const hasSignificantCode = norm !== "";

  const bySlug = await prisma.union.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  });

  const dataCommon = {
    upazilaId: args.upazilaId,
    name: args.name,
    ...(args.nameBn !== undefined ? { nameBn: args.nameBn } : {}),
    ...(args.nameEn !== undefined ? { nameEn: args.nameEn } : {}),
    ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
    ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
  };

  if (bySlug) {
    return prisma.union.update({
      where: { id: bySlug.id },
      data: {
        ...dataCommon,
        code: hasSignificantCode ? norm : args.code ?? null,
      },
    });
  }

  if (hasSignificantCode) {
    const trimId = await findUnionIdByTrimmedCode(prisma, args.upazilaId, norm);
    if (trimId) {
      return prisma.union.update({
        where: { id: trimId },
        data: {
          slug: args.slug,
          ...dataCommon,
          code: norm,
        },
      });
    }
  }

  return prisma.union.create({
    data: {
      upazilaId: args.upazilaId,
      slug: args.slug,
      name: args.name,
      nameBn: args.nameBn ?? null,
      nameEn: args.nameEn ?? null,
      code: hasSignificantCode ? norm : args.code?.trim() || null,
      sortOrder: args.sortOrder ?? 0,
      isActive: args.isActive ?? true,
      ...(args.source !== undefined ? { source: args.source } : {}),
      ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
    },
  });
}

export type UpsertVillageByTrimmedCodeArgs = {
  unionId: string;
  code: string | null | undefined;
  slug: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  isActive?: boolean;
  source?: string | null;
  isVerified?: boolean;
};

export async function upsertVillageByTrimmedCode(
  prisma: PrismaClient,
  args: UpsertVillageByTrimmedCodeArgs,
) {
  const norm = args.code?.trim() ?? "";
  const hasSignificantCode = norm !== "";

  const bySlug = await prisma.village.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  });

  const dataCommon = {
    unionId: args.unionId,
    name: args.name,
    ...(args.nameBn !== undefined ? { nameBn: args.nameBn } : {}),
    ...(args.nameEn !== undefined ? { nameEn: args.nameEn } : {}),
    ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
    ...(args.source !== undefined ? { source: args.source } : {}),
    ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
  };

  if (bySlug) {
    return prisma.village.update({
      where: { id: bySlug.id },
      data: {
        ...dataCommon,
        code: hasSignificantCode ? norm : args.code ?? null,
      },
    });
  }

  if (hasSignificantCode) {
    const trimId = await findVillageIdByTrimmedCode(prisma, args.unionId, norm);
    if (trimId) {
      return prisma.village.update({
        where: { id: trimId },
        data: {
          slug: args.slug,
          ...dataCommon,
          code: norm,
        },
      });
    }
  }

  return prisma.village.create({
    data: {
      unionId: args.unionId,
      slug: args.slug,
      name: args.name,
      nameBn: args.nameBn ?? null,
      nameEn: args.nameEn ?? null,
      code: hasSignificantCode ? norm : args.code?.trim() || null,
      isActive: args.isActive ?? true,
      ...(args.source !== undefined ? { source: args.source } : {}),
      ...(args.isVerified !== undefined ? { isVerified: args.isVerified } : {}),
    },
  });
}
