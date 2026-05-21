import { getPrisma } from '../../shared/database/prisma.js';

export type ResolvedAddressHierarchy = {
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  unionId?: string;
  villageId?: string;
  divisionNameBn?: string;
  districtNameBn?: string;
  upazilaNameBn?: string;
  unionNameBn?: string;
  villageNameBn?: string;
  areaLabel?: string;
};

function labelBn(row: {
  nameBn: string | null;
  nameEn: string | null;
  name: string;
}): string {
  return row.nameBn?.trim() || row.nameEn?.trim() || row.name.trim();
}

export class AreaCatalogService {
  readonly name = 'AreaCatalogService';

  async validateAndResolveHierarchy(ids: {
    divisionId?: string | undefined;
    districtId?: string | undefined;
    upazilaId?: string | undefined;
    unionId?: string | undefined;
    villageId?: string | undefined;
  }): Promise<{ ok: true; resolved: ResolvedAddressHierarchy } | { ok: false; code: string }> {
    const prisma = getPrisma();
    const resolved: ResolvedAddressHierarchy = {};
    if (ids.divisionId) resolved.divisionId = ids.divisionId;
    if (ids.districtId) resolved.districtId = ids.districtId;
    if (ids.upazilaId) resolved.upazilaId = ids.upazilaId;
    if (ids.unionId) resolved.unionId = ids.unionId;
    if (ids.villageId) resolved.villageId = ids.villageId;

    if (ids.villageId) {
      const village = await prisma.village.findFirst({
        where: { id: ids.villageId, isActive: true },
        include: {
          union: {
            include: {
              upazila: {
                include: { district: { include: { division: true } } },
              },
            },
          },
        },
      });
      if (!village) {
        return { ok: false, code: 'INVALID_VILLAGE' };
      }
      const un = village.union;
      const up = un.upazila;
      const dist = up.district;
      const div = dist.division;

      if (ids.unionId && ids.unionId !== un.id) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      if (ids.upazilaId && ids.upazilaId !== up.id) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      if (ids.districtId && ids.districtId !== dist.id) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      if (ids.divisionId && ids.divisionId !== div.id) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }

      resolved.unionId = un.id;
      resolved.upazilaId = up.id;
      resolved.districtId = dist.id;
      resolved.divisionId = div.id;
      resolved.villageNameBn = labelBn(village);
      resolved.unionNameBn = labelBn(un);
      resolved.upazilaNameBn = labelBn(up);
      resolved.districtNameBn = labelBn(dist);
      resolved.divisionNameBn = labelBn(div);
      resolved.areaLabel = resolved.villageNameBn;
      return { ok: true, resolved };
    }

    if (ids.unionId) {
      const union = await prisma.union.findFirst({
        where: { id: ids.unionId, isActive: true },
        include: { upazila: { include: { district: { include: { division: true } } } } },
      });
      if (!union) return { ok: false, code: 'INVALID_UNION' };
      if (ids.upazilaId && ids.upazilaId !== union.upazilaId) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      resolved.upazilaId = union.upazila.id;
      resolved.districtId = union.upazila.district.id;
      resolved.divisionId = union.upazila.district.division.id;
      resolved.unionNameBn = labelBn(union);
      resolved.upazilaNameBn = labelBn(union.upazila);
      resolved.districtNameBn = labelBn(union.upazila.district);
      resolved.divisionNameBn = labelBn(union.upazila.district.division);
      return { ok: true, resolved };
    }

    if (ids.upazilaId) {
      const upazila = await prisma.upazila.findFirst({
        where: { id: ids.upazilaId, isActive: true },
        include: { district: { include: { division: true } } },
      });
      if (!upazila) return { ok: false, code: 'INVALID_UPAZILA' };
      if (ids.districtId && ids.districtId !== upazila.districtId) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      resolved.districtId = upazila.district.id;
      resolved.divisionId = upazila.district.division.id;
      resolved.upazilaNameBn = labelBn(upazila);
      resolved.districtNameBn = labelBn(upazila.district);
      resolved.divisionNameBn = labelBn(upazila.district.division);
      return { ok: true, resolved };
    }

    if (ids.districtId) {
      const district = await prisma.district.findFirst({
        where: { id: ids.districtId, isActive: true },
        include: { division: true },
      });
      if (!district) return { ok: false, code: 'INVALID_DISTRICT' };
      if (ids.divisionId && ids.divisionId !== district.divisionId) {
        return { ok: false, code: 'HIERARCHY_MISMATCH' };
      }
      resolved.divisionId = district.division.id;
      resolved.districtNameBn = labelBn(district);
      resolved.divisionNameBn = labelBn(district.division);
      return { ok: true, resolved };
    }

    if (ids.divisionId) {
      const division = await prisma.division.findFirst({
        where: { id: ids.divisionId, isActive: true },
      });
      if (!division) return { ok: false, code: 'INVALID_DIVISION' };
      resolved.divisionNameBn = labelBn(division);
      return { ok: true, resolved };
    }

    return { ok: true, resolved };
  }
}

let defaultAreaCatalog: AreaCatalogService | null = null;

export function getAreaCatalogService(): AreaCatalogService {
  if (!defaultAreaCatalog) {
    defaultAreaCatalog = new AreaCatalogService();
  }
  return defaultAreaCatalog;
}
