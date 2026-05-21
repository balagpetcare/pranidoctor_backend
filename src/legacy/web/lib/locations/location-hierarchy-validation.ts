import { prisma } from "@/lib/prisma";

export type LocationHierarchyIds = {
  divisionId: string;
  districtId: string;
  upazilaId: string;
  unionId?: string | null;
  villageId?: string | null;
};

/**
 * Ensures FK chain: division ← district ← upazila ← union? ← village?
 * Returns `"INVALID"` with a reason code, or `{ ok: true }`.
 */
export async function assertLocationHierarchy(
  input: LocationHierarchyIds,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const district = await prisma.district.findFirst({
    where: {
      id: input.districtId,
      divisionId: input.divisionId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!district) {
    return { ok: false, reason: "DISTRICT_NOT_IN_DIVISION" };
  }

  const upazila = await prisma.upazila.findFirst({
    where: {
      id: input.upazilaId,
      districtId: input.districtId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!upazila) {
    return { ok: false, reason: "UPAZILA_NOT_IN_DISTRICT" };
  }

  if (input.unionId) {
    const union = await prisma.union.findFirst({
      where: {
        id: input.unionId,
        upazilaId: input.upazilaId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!union) {
      return { ok: false, reason: "UNION_NOT_IN_UPAZILA" };
    }
  } else if (input.villageId) {
    return { ok: false, reason: "VILLAGE_REQUIRES_UNION" };
  }

  if (input.villageId) {
    if (!input.unionId) {
      return { ok: false, reason: "VILLAGE_REQUIRES_UNION" };
    }
    const village = await prisma.village.findFirst({
      where: {
        id: input.villageId,
        unionId: input.unionId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!village) {
      return { ok: false, reason: "VILLAGE_NOT_IN_UNION" };
    }
  }

  return { ok: true };
}
