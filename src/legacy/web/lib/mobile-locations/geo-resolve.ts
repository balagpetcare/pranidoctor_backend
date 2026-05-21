import type { District, PrismaClient, Union, Upazila } from "@/generated/prisma/client";

function bnLabel(row: { nameBn: string | null; nameEn: string | null; name: string }): string {
  return row.nameBn?.trim() || row.nameEn?.trim() || row.name.trim();
}

export type ResolvedGeoLabels = {
  district: string;
  upazila: string;
  unionOrArea: string | null;
  districtRow: District;
  upazilaRow: Upazila;
  unionRow: Union | null;
};

/**
 * Validates `upazila` belongs to `district` and optional `union` belongs to `upazila`.
 * Returns Bengali-first labels for `AiTechnicianProfile` / division coverage text fields.
 */
export async function resolveGeoLabelsByIds(
  prisma: PrismaClient,
  input: { districtId: string; upazilaId: string; unionId?: string | null },
): Promise<ResolvedGeoLabels | "INVALID"> {
  const upazilaRow = await prisma.upazila.findFirst({
    where: { id: input.upazilaId, isActive: true },
    include: { district: true },
  });
  if (!upazilaRow || upazilaRow.districtId !== input.districtId) {
    return "INVALID";
  }

  const districtRow = upazilaRow.district;
  if (!districtRow.isActive) {
    return "INVALID";
  }

  let unionRow: Union | null = null;
  if (input.unionId) {
    unionRow = await prisma.union.findFirst({
      where: { id: input.unionId, upazilaId: input.upazilaId, isActive: true },
    });
    if (!unionRow) {
      return "INVALID";
    }
  }

  return {
    district: bnLabel(districtRow),
    upazila: bnLabel(upazilaRow),
    unionOrArea: unionRow ? bnLabel(unionRow) : null,
    districtRow,
    upazilaRow,
    unionRow,
  };
}
