import * as fs from "node:fs";
import * as path from "node:path";

import { prisma } from "@/lib/prisma";

export type LocationAdminStats = {
  counts: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    villages: number;
  };
  pendingVerification: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    villages: number;
  };
  missingCoordinates: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    villages: number;
  };
  /** Approximate duplicate-key groups in DB (non-null codes / names where applicable). */
  duplicateWarningCounts: {
    divisions: number;
    districts: number;
    upazilas: number;
    unions: number;
    unionVillageNamePairs: number;
  };
};

export async function getLocationAdminStats(): Promise<LocationAdminStats> {
  const [
    divisions,
    districts,
    upazilas,
    unions,
    villages,
    divUnverified,
    distUnverified,
    upUnverified,
    unUnverified,
    vilUnverified,
    divNoCoord,
    distNoCoord,
    upNoCoord,
    unNoCoord,
    vilNoCoord,
    dupDiv,
    dupDist,
    dupUp,
    dupUn,
    dupVilNames,
  ] = await Promise.all([
    prisma.division.count({ where: { isActive: true } }),
    prisma.district.count({ where: { isActive: true } }),
    prisma.upazila.count({ where: { isActive: true } }),
    prisma.union.count({ where: { isActive: true } }),
    prisma.village.count({ where: { isActive: true } }),
    prisma.division.count({ where: { isActive: true, isVerified: false } }),
    prisma.district.count({ where: { isActive: true, isVerified: false } }),
    prisma.upazila.count({ where: { isActive: true, isVerified: false } }),
    prisma.union.count({ where: { isActive: true, isVerified: false } }),
    prisma.village.count({ where: { isActive: true, isVerified: false } }),
    prisma.division.count({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
    }),
    prisma.district.count({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
    }),
    prisma.upazila.count({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
    }),
    prisma.union.count({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
    }),
    prisma.village.count({
      where: { isActive: true, OR: [{ latitude: null }, { longitude: null }] },
    }),
    countDuplicateDivisionCodes(),
    countDuplicateDistrictCodes(),
    countDuplicateUpazilaCodes(),
    countDuplicateUnionCodes(),
    countDuplicateVillageNamesUnderUnion(),
  ]);

  return {
    counts: {
      divisions,
      districts,
      upazilas,
      unions,
      villages,
    },
    pendingVerification: {
      divisions: divUnverified,
      districts: distUnverified,
      upazilas: upUnverified,
      unions: unUnverified,
      villages: vilUnverified,
    },
    missingCoordinates: {
      divisions: divNoCoord,
      districts: distNoCoord,
      upazilas: upNoCoord,
      unions: unNoCoord,
      villages: vilNoCoord,
    },
    duplicateWarningCounts: {
      divisions: dupDiv,
      districts: dupDist,
      upazilas: dupUp,
      unions: dupUn,
      unionVillageNamePairs: dupVilNames,
    },
  };
}

export type LocationLevel =
  | "DIVISION"
  | "DISTRICT"
  | "UPAZILA"
  | "UNION"
  | "VILLAGE"
  | "ALL";

export type LocationConcreteLevel = Exclude<LocationLevel, "ALL">;

export async function listMissingCoords(params: {
  level: LocationLevel;
  limit: number;
}): Promise<
  {
    id: string;
    code: string | null;
    nameEn: string;
    nameBn: string;
    level: LocationConcreteLevel;
  }[]
> {
  const take = Math.min(500, Math.max(1, params.limit));
  const whereCoord = {
    isActive: true,
    OR: [{ latitude: null }, { longitude: null }],
  };

  const label = (r: {
    name: string;
    nameBn: string | null;
    nameEn: string | null;
  }) => ({
    nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
    nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
  });

  switch (params.level) {
    case "DIVISION": {
      const rows = await prisma.division.findMany({
        where: whereCoord,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "DIVISION" as const,
        ...label(r),
      }));
    }
    case "DISTRICT": {
      const rows = await prisma.district.findMany({
        where: whereCoord,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "DISTRICT" as const,
        ...label(r),
      }));
    }
    case "UPAZILA": {
      const rows = await prisma.upazila.findMany({
        where: whereCoord,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "UPAZILA" as const,
        ...label(r),
      }));
    }
    case "UNION": {
      const rows = await prisma.union.findMany({
        where: whereCoord,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "UNION" as const,
        ...label(r),
      }));
    }
    case "VILLAGE": {
      const rows = await prisma.village.findMany({
        where: whereCoord,
        take,
        orderBy: { slug: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          nameBn: true,
          nameEn: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "VILLAGE" as const,
        nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
        nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
      }));
    }
    case "ALL": {
      const per = Math.max(1, Math.ceil(take / 5));
      const parts = await Promise.all([
        listMissingCoords({ level: "DIVISION", limit: per }),
        listMissingCoords({ level: "DISTRICT", limit: per }),
        listMissingCoords({ level: "UPAZILA", limit: per }),
        listMissingCoords({ level: "UNION", limit: per }),
        listMissingCoords({ level: "VILLAGE", limit: per }),
      ]);
      return parts.flat().slice(0, take);
    }
    default:
      return [];
  }
}

export async function listPendingVerification(params: {
  level: LocationLevel;
  limit: number;
}): Promise<
  {
    id: string;
    code: string | null;
    nameEn: string;
    nameBn: string;
    level: LocationConcreteLevel;
  }[]
> {
  const take = Math.min(500, Math.max(1, params.limit));
  const whereUnv = { isActive: true, isVerified: false } as const;

  const label = (r: {
    name: string;
    nameBn: string | null;
    nameEn: string | null;
  }) => ({
    nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
    nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
  });

  switch (params.level) {
    case "DIVISION": {
      const rows = await prisma.division.findMany({
        where: whereUnv,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "DIVISION" as const,
        ...label(r),
      }));
    }
    case "DISTRICT": {
      const rows = await prisma.district.findMany({
        where: whereUnv,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "DISTRICT" as const,
        ...label(r),
      }));
    }
    case "UPAZILA": {
      const rows = await prisma.upazila.findMany({
        where: whereUnv,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "UPAZILA" as const,
        ...label(r),
      }));
    }
    case "UNION": {
      const rows = await prisma.union.findMany({
        where: whereUnv,
        take,
        orderBy: { slug: "asc" },
        select: { id: true, code: true, name: true, nameBn: true, nameEn: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "UNION" as const,
        ...label(r),
      }));
    }
    case "VILLAGE": {
      const rows = await prisma.village.findMany({
        where: whereUnv,
        take,
        orderBy: { slug: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          nameBn: true,
          nameEn: true,
        },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        level: "VILLAGE" as const,
        nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
        nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
      }));
    }
    case "ALL": {
      const per = Math.max(1, Math.ceil(take / 5));
      const parts = await Promise.all([
        listPendingVerification({ level: "DIVISION", limit: per }),
        listPendingVerification({ level: "DISTRICT", limit: per }),
        listPendingVerification({ level: "UPAZILA", limit: per }),
        listPendingVerification({ level: "UNION", limit: per }),
        listPendingVerification({ level: "VILLAGE", limit: per }),
      ]);
      return parts.flat().slice(0, take);
    }
    default:
      return [];
  }
}

async function countDuplicateDivisionCodes(): Promise<number> {
  const r = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT code FROM "Division"
      WHERE code IS NOT NULL AND TRIM(code) <> ''
      GROUP BY code HAVING COUNT(*) > 1
    ) s
  `;
  return Number(r[0]?.c ?? 0);
}

async function countDuplicateDistrictCodes(): Promise<number> {
  const r = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "divisionId", code FROM "District"
      WHERE code IS NOT NULL AND TRIM(code) <> ''
      GROUP BY "divisionId", code HAVING COUNT(*) > 1
    ) s
  `;
  return Number(r[0]?.c ?? 0);
}

async function countDuplicateUpazilaCodes(): Promise<number> {
  const r = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "districtId", code FROM "Upazila"
      WHERE code IS NOT NULL AND TRIM(code) <> ''
      GROUP BY "districtId", code HAVING COUNT(*) > 1
    ) s
  `;
  return Number(r[0]?.c ?? 0);
}

async function countDuplicateUnionCodes(): Promise<number> {
  const r = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "upazilaId", code FROM "Union"
      WHERE code IS NOT NULL AND TRIM(code) <> ''
      GROUP BY "upazilaId", code HAVING COUNT(*) > 1
    ) s
  `;
  return Number(r[0]?.c ?? 0);
}

async function countDuplicateVillageNamesUnderUnion(): Promise<number> {
  const r = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT "unionId", LOWER(TRIM(COALESCE("nameBn", "nameEn", "name"))) AS k
      FROM "Village"
      WHERE "isActive" = true
      GROUP BY "unionId", LOWER(TRIM(COALESCE("nameBn", "nameEn", "name")))
      HAVING COUNT(*) > 1
    ) s
  `;
  return Number(r[0]?.c ?? 0);
}

const IMPORT_REPORT_PATH = path.join(
  process.cwd(),
  "data",
  "locations",
  "import-report.json",
);

export function readLocationImportReport(): unknown | null {
  try {
    if (!fs.existsSync(IMPORT_REPORT_PATH)) return null;
    return JSON.parse(fs.readFileSync(IMPORT_REPORT_PATH, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export type DuplicateLocationSample = {
  id: string;
  level: LocationConcreteLevel;
  code: string | null;
  nameEn: string;
  nameBn: string;
  slug: string;
};

export async function listDuplicateLocationSamples(params: {
  level: LocationLevel;
  limit: number;
}): Promise<{
  level: LocationLevel;
  limit: number;
  items: DuplicateLocationSample[];
}> {
  const lim = Math.min(200, Math.max(1, params.limit));

  async function divSamples(): Promise<DuplicateLocationSample[]> {
    const rows = await prisma.$queryRaw<
      { id: string; code: string | null; slug: string; name: string; nameBn: string | null; nameEn: string | null }[]
    >`
      SELECT d.id, d.code, d.slug, d.name, d."nameBn", d."nameEn"
      FROM "Division" d
      INNER JOIN (
        SELECT code FROM "Division"
        WHERE code IS NOT NULL AND TRIM(code) <> ''
        GROUP BY code HAVING COUNT(*) > 1
      ) x ON d.code = x.code
      ORDER BY d.code, d.slug
      LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      level: "DIVISION" as const,
      code: r.code,
      slug: r.slug,
      nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
      nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    }));
  }

  async function distSamples(): Promise<DuplicateLocationSample[]> {
    const rows = await prisma.$queryRaw<
      { id: string; code: string | null; slug: string; name: string; nameBn: string | null; nameEn: string | null }[]
    >`
      SELECT d.id, d.code, d.slug, d.name, d."nameBn", d."nameEn"
      FROM "District" d
      INNER JOIN (
        SELECT "divisionId", code FROM "District"
        WHERE code IS NOT NULL AND TRIM(code) <> ''
        GROUP BY "divisionId", code HAVING COUNT(*) > 1
      ) x ON d."divisionId" = x."divisionId" AND d.code = x.code
      ORDER BY d.code, d.slug
      LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      level: "DISTRICT" as const,
      code: r.code,
      slug: r.slug,
      nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
      nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    }));
  }

  async function upSamples(): Promise<DuplicateLocationSample[]> {
    const rows = await prisma.$queryRaw<
      { id: string; code: string | null; slug: string; name: string; nameBn: string | null; nameEn: string | null }[]
    >`
      SELECT u.id, u.code, u.slug, u.name, u."nameBn", u."nameEn"
      FROM "Upazila" u
      INNER JOIN (
        SELECT "districtId", code FROM "Upazila"
        WHERE code IS NOT NULL AND TRIM(code) <> ''
        GROUP BY "districtId", code HAVING COUNT(*) > 1
      ) x ON u."districtId" = x."districtId" AND u.code = x.code
      ORDER BY u.code, u.slug
      LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      level: "UPAZILA" as const,
      code: r.code,
      slug: r.slug,
      nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
      nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    }));
  }

  async function unSamples(): Promise<DuplicateLocationSample[]> {
    const rows = await prisma.$queryRaw<
      { id: string; code: string | null; slug: string; name: string; nameBn: string | null; nameEn: string | null }[]
    >`
      SELECT u.id, u.code, u.slug, u.name, u."nameBn", u."nameEn"
      FROM "Union" u
      INNER JOIN (
        SELECT "upazilaId", code FROM "Union"
        WHERE code IS NOT NULL AND TRIM(code) <> ''
        GROUP BY "upazilaId", code HAVING COUNT(*) > 1
      ) x ON u."upazilaId" = x."upazilaId" AND u.code = x.code
      ORDER BY u.code, u.slug
      LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      level: "UNION" as const,
      code: r.code,
      slug: r.slug,
      nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
      nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    }));
  }

  async function vilSamples(): Promise<DuplicateLocationSample[]> {
    const rows = await prisma.$queryRaw<
      { id: string; code: string | null; slug: string; name: string; nameBn: string | null; nameEn: string | null }[]
    >`
      SELECT v.id, v.code, v.slug, v.name, v."nameBn", v."nameEn"
      FROM "Village" v
      INNER JOIN (
        SELECT "unionId", LOWER(TRIM(COALESCE("nameBn", "nameEn", "name"))) AS k
        FROM "Village"
        WHERE "isActive" = true
        GROUP BY "unionId", LOWER(TRIM(COALESCE("nameBn", "nameEn", "name")))
        HAVING COUNT(*) > 1
      ) x ON v."unionId" = x."unionId"
        AND LOWER(TRIM(COALESCE(v."nameBn", v."nameEn", v.name))) = x.k
      ORDER BY v.slug
      LIMIT ${lim}
    `;
    return rows.map((r) => ({
      id: r.id,
      level: "VILLAGE" as const,
      code: r.code,
      slug: r.slug,
      nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
      nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    }));
  }

  if (params.level === "ALL") {
    const per = Math.max(1, Math.ceil(lim / 5));
    const parts = await Promise.all([
      listDuplicateLocationSamples({ level: "DIVISION", limit: per }),
      listDuplicateLocationSamples({ level: "DISTRICT", limit: per }),
      listDuplicateLocationSamples({ level: "UPAZILA", limit: per }),
      listDuplicateLocationSamples({ level: "UNION", limit: per }),
      listDuplicateLocationSamples({ level: "VILLAGE", limit: per }),
    ]);
    return {
      level: "ALL",
      limit: lim,
      items: parts.flatMap((p) => p.items).slice(0, lim),
    };
  }

  let items: DuplicateLocationSample[] = [];
  switch (params.level) {
    case "DIVISION":
      items = await divSamples();
      break;
    case "DISTRICT":
      items = await distSamples();
      break;
    case "UPAZILA":
      items = await upSamples();
      break;
    case "UNION":
      items = await unSamples();
      break;
    case "VILLAGE":
      items = await vilSamples();
      break;
    default:
      items = [];
  }

  return { level: params.level, limit: lim, items };
}
