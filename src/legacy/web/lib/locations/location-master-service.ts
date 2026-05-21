import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { dedupeMobileLocationRows } from "./location-dedupe-logic.js";

export type LocationMasterRow = {
  id: string;
  slug: string;
  code: string | null;
  nameEn: string;
  nameBn: string;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
};

function numFromDecimal(v: unknown): number | null {
  if (v == null) return null;
  if (
    typeof v === "object" &&
    v !== null &&
    "toNumber" in v &&
    typeof (v as { toNumber: () => number }).toNumber === "function"
  ) {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function labelEn(row: {
  nameEn: string | null;
  nameBn: string | null;
  name: string;
}): string {
  return row.nameEn?.trim() || row.nameBn?.trim() || row.name.trim();
}

function labelBn(row: {
  nameEn: string | null;
  nameBn: string | null;
  name: string;
}): string {
  return row.nameBn?.trim() || row.nameEn?.trim() || row.name.trim();
}

function mapDivision(r: {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
}): LocationMasterRow {
  return {
    id: r.id,
    slug: r.slug,
    code: r.code,
    nameEn: labelEn(r),
    nameBn: labelBn(r),
    latitude: numFromDecimal(r.latitude),
    longitude: numFromDecimal(r.longitude),
    isVerified: r.isVerified,
  };
}

function mapDistrict(r: {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
}): LocationMasterRow {
  return {
    id: r.id,
    slug: r.slug,
    code: r.code,
    nameEn: labelEn(r),
    nameBn: labelBn(r),
    latitude: numFromDecimal(r.latitude),
    longitude: numFromDecimal(r.longitude),
    isVerified: r.isVerified,
  };
}

function mapUpazila(r: {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
}): LocationMasterRow {
  return mapDistrict(r);
}

function mapUnion(r: {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
}): LocationMasterRow {
  return mapDistrict(r);
}

function mapVillage(r: {
  id: string;
  slug: string;
  code: string | null;
  name: string;
  nameBn: string | null;
  nameEn: string | null;
  latitude: unknown;
  longitude: unknown;
  isVerified: boolean;
}): LocationMasterRow {
  return {
    id: r.id,
    slug: r.slug,
    code: r.code,
    nameEn: r.nameEn?.trim() || r.nameBn?.trim() || r.name.trim(),
    nameBn: r.nameBn?.trim() || r.nameEn?.trim() || r.name.trim(),
    latitude: numFromDecimal(r.latitude),
    longitude: numFromDecimal(r.longitude),
    isVerified: r.isVerified,
  };
}

const divOrder = [
  { sortOrder: "asc" as const },
  { nameBn: "asc" as const },
  { slug: "asc" as const },
];

const districtOrder = [
  { sortOrder: "asc" as const },
  { nameBn: "asc" as const },
  { slug: "asc" as const },
];

const upazilaOrder = [
  { sortOrder: "asc" as const },
  { nameBn: "asc" as const },
  { slug: "asc" as const },
];

const unionOrder = [
  { sortOrder: "asc" as const },
  { nameBn: "asc" as const },
  { slug: "asc" as const },
];

const villageOrder = [
  { nameBn: "asc" as const },
  { slug: "asc" as const },
];

const divisionSelect = {
  id: true,
  slug: true,
  code: true,
  name: true,
  nameBn: true,
  nameEn: true,
  latitude: true,
  longitude: true,
  isVerified: true,
} as const;

export async function listDivisionsMaster(): Promise<LocationMasterRow[]> {
  const rows = await prisma.division.findMany({
    where: { isActive: true },
    orderBy: divOrder,
    select: divisionSelect,
  });
  return dedupeMobileLocationRows(rows.map(mapDivision));
}

export async function listDistrictsMaster(params: {
  divisionId?: string;
}): Promise<LocationMasterRow[]> {
  const rows = await prisma.district.findMany({
    where: {
      isActive: true,
      ...(params.divisionId ? { divisionId: params.divisionId } : {}),
    },
    orderBy: districtOrder,
    select: divisionSelect,
  });
  return dedupeMobileLocationRows(rows.map(mapDistrict));
}

export async function listUpazilasMaster(params: {
  districtId: string;
}): Promise<LocationMasterRow[]> {
  const rows = await prisma.upazila.findMany({
    where: { districtId: params.districtId, isActive: true },
    orderBy: upazilaOrder,
    select: divisionSelect,
  });
  return dedupeMobileLocationRows(rows.map(mapUpazila));
}

export async function listUnionsMaster(params: {
  upazilaId: string;
}): Promise<LocationMasterRow[]> {
  const rows = await prisma.union.findMany({
    where: { upazilaId: params.upazilaId, isActive: true },
    orderBy: unionOrder,
    select: divisionSelect,
  });
  return dedupeMobileLocationRows(rows.map(mapUnion));
}

export async function listVillagesMaster(params: {
  unionId: string;
}): Promise<LocationMasterRow[]> {
  const rows = await prisma.village.findMany({
    where: { unionId: params.unionId, isActive: true },
    orderBy: villageOrder,
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      nameBn: true,
      nameEn: true,
      latitude: true,
      longitude: true,
      isVerified: true,
    },
  });
  return dedupeMobileLocationRows(rows.map(mapVillage));
}

export type LocationSearchLevel =
  | "DIVISION"
  | "DISTRICT"
  | "UPAZILA"
  | "UNION"
  | "VILLAGE";

export type LocationMasterSearchHit = LocationMasterRow & {
  level: LocationSearchLevel;
};

export async function searchLocationsMaster(params: {
  q: string;
  limit: number;
  level?: LocationSearchLevel | "ALL";
}): Promise<LocationMasterSearchHit[]> {
  const term = params.q.trim();
  const mode = "insensitive" as const;
  const limit = Math.min(100, Math.max(1, params.limit));
  const level = params.level ?? "ALL";

  const perBucket =
    level === "ALL" ? Math.min(25, Math.max(5, Math.ceil(limit / 5))) : limit;

  const orName = [
    { name: { contains: term, mode } },
    { nameBn: { contains: term, mode } },
    { nameEn: { contains: term, mode } },
    { slug: { contains: term, mode } },
    { code: { contains: term, mode } },
  ];

  const hits: LocationMasterSearchHit[] = [];

  if (level === "ALL" || level === "DIVISION") {
    const rows = await prisma.division.findMany({
      where: { isActive: true, OR: orName },
      take: perBucket,
      orderBy: divOrder,
      select: divisionSelect,
    });
    hits.push(...rows.map((r) => ({ ...mapDivision(r), level: "DIVISION" as const })));
  }
  if (level === "ALL" || level === "DISTRICT") {
    const rows = await prisma.district.findMany({
      where: { isActive: true, OR: orName },
      take: perBucket,
      orderBy: districtOrder,
      select: divisionSelect,
    });
    hits.push(...rows.map((r) => ({ ...mapDistrict(r), level: "DISTRICT" as const })));
  }
  if (level === "ALL" || level === "UPAZILA") {
    const rows = await prisma.upazila.findMany({
      where: { isActive: true, OR: orName },
      take: perBucket,
      orderBy: upazilaOrder,
      select: divisionSelect,
    });
    hits.push(...rows.map((r) => ({ ...mapUpazila(r), level: "UPAZILA" as const })));
  }
  if (level === "ALL" || level === "UNION") {
    const rows = await prisma.union.findMany({
      where: { isActive: true, OR: orName },
      take: perBucket,
      orderBy: unionOrder,
      select: divisionSelect,
    });
    hits.push(...rows.map((r) => ({ ...mapUnion(r), level: "UNION" as const })));
  }
  if (level === "ALL" || level === "VILLAGE") {
    const rows = await prisma.village.findMany({
      where: { isActive: true, OR: orName },
      take: perBucket,
      orderBy: villageOrder,
      select: {
        id: true,
        slug: true,
        code: true,
        name: true,
        nameBn: true,
        nameEn: true,
        latitude: true,
        longitude: true,
        isVerified: true,
      },
    });
    hits.push(...rows.map((r) => ({ ...mapVillage(r), level: "VILLAGE" as const })));
  }

  return hits.slice(0, limit);
}

export type LocationTreeNode = LocationMasterRow & {
  districts?: LocationTreeChildDistrict[];
};

export type LocationTreeChildDistrict = LocationMasterRow & {
  upazilas?: LocationTreeChildUpazila[];
};

export type LocationTreeChildUpazila = LocationMasterRow & {
  unions?: LocationTreeChildUnion[];
};

export type LocationTreeChildUnion = LocationMasterRow & {
  villages?: LocationMasterRow[];
};

export async function getLocationTree(params: {
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  unionId?: string;
}): Promise<LocationTreeNode[]> {
  const divWhere =
    params.divisionId != null && params.divisionId !== ""
      ? { id: params.divisionId, isActive: true }
      : { isActive: true };

  const divisions = await prisma.division.findMany({
    where: divWhere,
    orderBy: divOrder,
    select: divisionSelect,
  });

  const out: LocationTreeNode[] = [];

  for (const d of divisions) {
    const dRow = mapDivision(d);
    const node: LocationTreeNode = { ...dRow, districts: [] };

    const distWhere: Prisma.DistrictWhereInput = {
      divisionId: d.id,
      isActive: true,
      ...(params.districtId ? { id: params.districtId } : {}),
    };
    const districtsRaw = await prisma.district.findMany({
      where: distWhere,
      orderBy: districtOrder,
      select: divisionSelect,
    });
    const districts = dedupeMobileLocationRows(districtsRaw.map(mapDistrict))
      .map((row) => districtsRaw.find((d) => d.id === row.id))
      .filter((d): d is NonNullable<typeof d> => d != null);

    for (const dist of districts) {
      const distRow = mapDistrict(dist);
      const dNode: LocationTreeChildDistrict = { ...distRow, upazilas: [] };

      const upWhere: Prisma.UpazilaWhereInput = {
        districtId: dist.id,
        isActive: true,
        ...(params.upazilaId ? { id: params.upazilaId } : {}),
      };
      const upazilasRaw = await prisma.upazila.findMany({
        where: upWhere,
        orderBy: upazilaOrder,
        select: divisionSelect,
      });
      const upazilas = dedupeMobileLocationRows(upazilasRaw.map(mapUpazila))
        .map((row) => upazilasRaw.find((u) => u.id === row.id))
        .filter((u): u is NonNullable<typeof u> => u != null);

      for (const up of upazilas) {
        const upRow = mapUpazila(up);
        const uNode: LocationTreeChildUpazila = { ...upRow, unions: [] };

        const unWhere: Prisma.UnionWhereInput = {
          upazilaId: up.id,
          isActive: true,
          ...(params.unionId ? { id: params.unionId } : {}),
        };
        const unionsRaw = await prisma.union.findMany({
          where: unWhere,
          orderBy: unionOrder,
          select: divisionSelect,
        });
        const unions = dedupeMobileLocationRows(unionsRaw.map(mapUnion))
          .map((row) => unionsRaw.find((u) => u.id === row.id))
          .filter((u): u is NonNullable<typeof u> => u != null);

        for (const un of unions) {
          const unRow = mapUnion(un);
          const unNode: LocationTreeChildUnion = { ...unRow, villages: [] };

          const villagesRaw = await prisma.village.findMany({
            where: { unionId: un.id, isActive: true },
            orderBy: villageOrder,
            select: {
              id: true,
              slug: true,
              code: true,
              name: true,
              nameBn: true,
              nameEn: true,
              latitude: true,
              longitude: true,
              isVerified: true,
            },
          });
          const villagesOrdered = dedupeMobileLocationRows(villagesRaw.map(mapVillage))
            .map((row) => villagesRaw.find((v) => v.id === row.id))
            .filter((v): v is NonNullable<typeof v> => v != null);
          unNode.villages = villagesOrdered.map(mapVillage);
          uNode.unions!.push(unNode);
        }
        dNode.upazilas!.push(uNode);
      }
      node.districts!.push(dNode);
    }
    out.push(node);
  }

  return out;
}
