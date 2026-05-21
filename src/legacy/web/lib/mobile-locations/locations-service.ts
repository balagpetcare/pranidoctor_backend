import { prisma } from "@/lib/prisma";
import {
  listDistrictsMaster,
  listDivisionsMaster,
  listUnionsMaster,
  listUpazilasMaster,
  listVillagesMaster,
  searchLocationsMaster,
} from "@/lib/locations/location-master-service";

import type {
  ListDistrictsQuery,
  ListUnionsQuery,
  ListUpazilasQuery,
  ListVillagesQuery,
  SearchLocationsQuery,
} from "./schemas";

export type MobileLocationDto = {
  id: string;
  slug: string;
  nameBn: string;
  nameEn: string;
  code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isVerified?: boolean;
};

function toMobileDto(row: {
  id: string;
  slug: string;
  code: string | null;
  nameBn: string;
  nameEn: string;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
}): MobileLocationDto {
  return {
    id: row.id,
    slug: row.slug,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    code: row.code,
    latitude: row.latitude,
    longitude: row.longitude,
    isVerified: row.isVerified,
  };
}

export async function listDivisionsForMobile(): Promise<MobileLocationDto[]> {
  const rows = await listDivisionsMaster();
  return rows.map(toMobileDto);
}

export async function listDistrictsForMobile(
  query: ListDistrictsQuery,
): Promise<MobileLocationDto[]> {
  const rows = await listDistrictsMaster(query);
  return rows.map(toMobileDto);
}

export async function listUpazilasForMobile(
  query: ListUpazilasQuery,
): Promise<MobileLocationDto[]> {
  const rows = await listUpazilasMaster(query);
  return rows.map(toMobileDto);
}

export async function listUnionsForMobile(
  query: ListUnionsQuery,
): Promise<MobileLocationDto[] | "DISTRICT_MISMATCH"> {
  const upazila = await prisma.upazila.findFirst({
    where: { id: query.upazilaId, districtId: query.districtId, isActive: true },
    select: { id: true },
  });
  if (!upazila) {
    return "DISTRICT_MISMATCH";
  }

  const rows = await listUnionsMaster({ upazilaId: query.upazilaId });
  return rows.map(toMobileDto);
}

export async function listVillagesForMobile(
  query: ListVillagesQuery,
): Promise<MobileLocationDto[]> {
  const rows = await listVillagesMaster(query);
  return rows.map(toMobileDto);
}

export type LocationSearchHit = MobileLocationDto & {
  level: "DIVISION" | "DISTRICT" | "UPAZILA" | "UNION" | "VILLAGE";
};

export async function searchLocationsForMobile(
  query: SearchLocationsQuery,
): Promise<LocationSearchHit[]> {
  const level = query.level ?? "ALL";
  const hits = await searchLocationsMaster({
    q: query.q,
    limit: query.limit,
    level,
  });

  if (query.level == null) {
    const legacy = hits.filter(
      (h) =>
        h.level === "DISTRICT" ||
        h.level === "UPAZILA" ||
        h.level === "UNION",
    );
    return legacy.slice(0, query.limit).map((h) => ({
      ...toMobileDto(h),
      level: h.level as "DISTRICT" | "UPAZILA" | "UNION",
    }));
  }

  return hits.slice(0, query.limit).map((h) => ({
    ...toMobileDto(h),
    level: h.level,
  }));
}
