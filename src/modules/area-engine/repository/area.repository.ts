import { getPrisma } from '../../../shared/database/prisma.js';
import type { PaginatedResult } from '../../../shared/types/api.types.js';
import {
  calculateSkip,
  normalizePagination,
  paginatedResponse,
} from '../../../shared/utils/pagination.js';

import type { AreaLevel, AreaListQuery, AreaLocale, AreaNodeDto } from '../area-engine.types.js';
import {
  AREA_SELECT,
  DEFAULT_CHILD_ORDER,
  DIVISION_ORDER,
  VILLAGE_ORDER,
  dedupeAreaNodes,
  mapAreaNode,
} from '../domain/area.mapper.js';
import { getAreaCacheService } from '../cache/area-cache.service.js';

export class AreaRepository {
  readonly name = 'AreaRepository';

  async listDivisions(query: AreaListQuery = {}): Promise<PaginatedResult<AreaNodeDto>> {
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const cache = getAreaCacheService();

    return cache.getDivisions(page, pageSize, async () => {
      const prisma = getPrisma();
      const where = { isActive: true };
      const [total, rows] = await Promise.all([
        prisma.division.count({ where }),
        prisma.division.findMany({
          where,
          orderBy: DIVISION_ORDER,
          skip: calculateSkip(page, pageSize),
          take: pageSize,
          select: AREA_SELECT,
        }),
      ]);
      const data = dedupeAreaNodes(
        rows.map((r) => mapAreaNode(r, 'DIVISION', null, locale)),
      );
      return paginatedResponse(data, total, page, pageSize);
    });
  }

  async listDistricts(
    divisionId: string,
    query: AreaListQuery = {},
  ): Promise<PaginatedResult<AreaNodeDto>> {
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const cache = getAreaCacheService();

    return cache.getDistricts(divisionId, page, pageSize, async () => {
      const prisma = getPrisma();
      const parent = await prisma.division.findFirst({
        where: { id: divisionId, isActive: true },
        select: { id: true },
      });
      if (!parent) return paginatedResponse([], 0, page, pageSize);

      const where = { divisionId, isActive: true };
      const [total, rows] = await Promise.all([
        prisma.district.count({ where }),
        prisma.district.findMany({
          where,
          orderBy: DEFAULT_CHILD_ORDER,
          skip: calculateSkip(page, pageSize),
          take: pageSize,
          select: AREA_SELECT,
        }),
      ]);
      const data = dedupeAreaNodes(
        rows.map((r) => mapAreaNode(r, 'DISTRICT', divisionId, locale)),
      );
      return paginatedResponse(data, total, page, pageSize);
    });
  }

  async listUpazilas(
    districtId: string,
    query: AreaListQuery = {},
  ): Promise<PaginatedResult<AreaNodeDto>> {
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const cache = getAreaCacheService();

    return cache.getUpazilas(districtId, page, pageSize, async () => {
      const prisma = getPrisma();
      const parent = await prisma.district.findFirst({
        where: { id: districtId, isActive: true },
        select: { id: true },
      });
      if (!parent) return paginatedResponse([], 0, page, pageSize);

      const where = { districtId, isActive: true };
      const [total, rows] = await Promise.all([
        prisma.upazila.count({ where }),
        prisma.upazila.findMany({
          where,
          orderBy: DEFAULT_CHILD_ORDER,
          skip: calculateSkip(page, pageSize),
          take: pageSize,
          select: AREA_SELECT,
        }),
      ]);
      const data = dedupeAreaNodes(
        rows.map((r) => mapAreaNode(r, 'UPAZILA', districtId, locale)),
      );
      return paginatedResponse(data, total, page, pageSize);
    });
  }

  async listUnions(
    upazilaId: string,
    query: AreaListQuery = {},
  ): Promise<PaginatedResult<AreaNodeDto>> {
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const cache = getAreaCacheService();

    return cache.getUnions(upazilaId, page, pageSize, async () => {
      const prisma = getPrisma();
      const parent = await prisma.upazila.findFirst({
        where: { id: upazilaId, isActive: true },
        select: { id: true },
      });
      if (!parent) return paginatedResponse([], 0, page, pageSize);

      const where = { upazilaId, isActive: true };
      const [total, rows] = await Promise.all([
        prisma.union.count({ where }),
        prisma.union.findMany({
          where,
          orderBy: DEFAULT_CHILD_ORDER,
          skip: calculateSkip(page, pageSize),
          take: pageSize,
          select: AREA_SELECT,
        }),
      ]);
      const data = dedupeAreaNodes(
        rows.map((r) => mapAreaNode(r, 'UNION', upazilaId, locale)),
      );
      return paginatedResponse(data, total, page, pageSize);
    });
  }

  async listVillages(
    unionId: string,
    query: AreaListQuery = {},
  ): Promise<PaginatedResult<AreaNodeDto>> {
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const cache = getAreaCacheService();

    return cache.getVillages(unionId, page, pageSize, async () => {
      const prisma = getPrisma();
      const parent = await prisma.union.findFirst({
        where: { id: unionId, isActive: true },
        select: { id: true },
      });
      if (!parent) return paginatedResponse([], 0, page, pageSize);

      const where = { unionId, isActive: true };
      const [total, rows] = await Promise.all([
        prisma.village.count({ where }),
        prisma.village.findMany({
          where,
          orderBy: VILLAGE_ORDER,
          skip: calculateSkip(page, pageSize),
          take: pageSize,
          select: AREA_SELECT,
        }),
      ]);
      const data = dedupeAreaNodes(
        rows.map((r) => mapAreaNode(r, 'VILLAGE', unionId, locale)),
      );
      return paginatedResponse(data, total, page, pageSize);
    });
  }

  async assertParentExists(level: AreaLevel, parentId: string): Promise<boolean> {
    const prisma = getPrisma();
    switch (level) {
      case 'DISTRICT':
        return !!(await prisma.division.findFirst({ where: { id: parentId, isActive: true } }));
      case 'UPAZILA':
        return !!(await prisma.district.findFirst({ where: { id: parentId, isActive: true } }));
      case 'UNION':
        return !!(await prisma.upazila.findFirst({ where: { id: parentId, isActive: true } }));
      case 'VILLAGE':
        return !!(await prisma.union.findFirst({ where: { id: parentId, isActive: true } }));
      default:
        return true;
    }
  }
}

let repository: AreaRepository | null = null;

export function getAreaRepository(): AreaRepository {
  if (!repository) repository = new AreaRepository();
  return repository;
}
