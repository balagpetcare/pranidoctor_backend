import type { PaginatedResult } from '../../../shared/types/api.types.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import {
  calculateSkip,
  normalizePagination,
  paginatedResponse,
} from '../../../shared/utils/pagination.js';

import type { AreaLevel, AreaSearchHitDto, AreaSearchQuery } from '../area-engine.types.js';
import {
  AREA_SELECT,
  DEFAULT_CHILD_ORDER,
  DIVISION_ORDER,
  VILLAGE_ORDER,
  dedupeAreaNodes,
  mapAreaNode,
  pickLabel,
} from '../domain/area.mapper.js';
import { getAreaCacheService } from '../cache/area-cache.service.js';

function buildNameFilter(term: string) {
  const mode = 'insensitive' as const;
  return [
    { name: { contains: term, mode } },
    { nameBn: { contains: term, mode } },
    { nameEn: { contains: term, mode } },
    { slug: { contains: term, mode } },
    { code: { contains: term, mode } },
  ];
}

export class AreaSearchService {
  readonly name = 'AreaSearchService';

  async search(query: AreaSearchQuery): Promise<PaginatedResult<AreaSearchHitDto>> {
    const term = query.q.trim();
    const { page, pageSize } = normalizePagination(query);
    const locale = query.locale ?? 'bn';
    const level = query.level ?? 'ALL';

    if (!term) {
      return paginatedResponse([], 0, page, pageSize);
    }

    const cache = getAreaCacheService();
    return cache.getSearch(
      {
        q: term,
        level,
        page,
        pageSize,
        locale,
        divisionId: query.divisionId,
        districtId: query.districtId,
        upazilaId: query.upazilaId,
        unionId: query.unionId,
      },
      () => this.searchDb(term, level, query, page, pageSize, locale),
    );
  }

  private async searchDb(
    term: string,
    level: AreaLevel | 'ALL',
    scope: AreaSearchQuery,
    page: number,
    pageSize: number,
    locale: 'bn' | 'en',
  ): Promise<PaginatedResult<AreaSearchHitDto>> {
    const prisma = getPrisma();
    const perBucket =
      level === 'ALL' ? Math.min(25, Math.max(5, Math.ceil(pageSize / 5))) : pageSize;

    const hits: AreaSearchHitDto[] = [];
    const orName = buildNameFilter(term);

    if (level === 'ALL' || level === 'DIVISION') {
      const rows = await prisma.division.findMany({
        where: { isActive: true, OR: orName },
        take: perBucket,
        orderBy: DIVISION_ORDER,
        select: AREA_SELECT,
      });
      hits.push(
        ...rows.map((r) => ({
          ...mapAreaNode(r, 'DIVISION', null, locale),
          breadcrumb: pickLabel(r, locale),
        })),
      );
    }

    if (level === 'ALL' || level === 'DISTRICT') {
      const rows = await prisma.district.findMany({
        where: {
          isActive: true,
          OR: orName,
          ...(scope.divisionId ? { divisionId: scope.divisionId } : {}),
        },
        take: perBucket,
        orderBy: DEFAULT_CHILD_ORDER,
        select: { ...AREA_SELECT, divisionId: true },
      });
      hits.push(
        ...rows.map((r) => ({
          ...mapAreaNode(r, 'DISTRICT', r.divisionId, locale),
          breadcrumb: pickLabel(r, locale),
        })),
      );
    }

    if (level === 'ALL' || level === 'UPAZILA') {
      const rows = await prisma.upazila.findMany({
        where: {
          isActive: true,
          OR: orName,
          ...(scope.districtId ? { districtId: scope.districtId } : {}),
          ...(scope.divisionId
            ? { district: { divisionId: scope.divisionId } }
            : {}),
        },
        take: perBucket,
        orderBy: DEFAULT_CHILD_ORDER,
        select: { ...AREA_SELECT, districtId: true },
      });
      hits.push(
        ...rows.map((r) => ({
          ...mapAreaNode(r, 'UPAZILA', r.districtId, locale),
          breadcrumb: pickLabel(r, locale),
        })),
      );
    }

    if (level === 'ALL' || level === 'UNION') {
      const rows = await prisma.union.findMany({
        where: {
          isActive: true,
          OR: orName,
          ...(scope.upazilaId ? { upazilaId: scope.upazilaId } : {}),
          ...(scope.districtId
            ? { upazila: { districtId: scope.districtId } }
            : {}),
        },
        take: perBucket,
        orderBy: DEFAULT_CHILD_ORDER,
        select: { ...AREA_SELECT, upazilaId: true },
      });
      hits.push(
        ...rows.map((r) => ({
          ...mapAreaNode(r, 'UNION', r.upazilaId, locale),
          breadcrumb: pickLabel(r, locale),
        })),
      );
    }

    if (level === 'ALL' || level === 'VILLAGE') {
      const rows = await prisma.village.findMany({
        where: {
          isActive: true,
          OR: orName,
          ...(scope.unionId ? { unionId: scope.unionId } : {}),
          ...(scope.upazilaId ? { union: { upazilaId: scope.upazilaId } } : {}),
        },
        take: perBucket,
        orderBy: VILLAGE_ORDER,
        select: { ...AREA_SELECT, unionId: true },
      });
      hits.push(
        ...rows.map((r) => ({
          ...mapAreaNode(r, 'VILLAGE', r.unionId, locale),
          breadcrumb: pickLabel(r, locale),
        })),
      );
    }

    const deduped = dedupeAreaNodes(hits);
    const skip = calculateSkip(page, pageSize);
    const pageRows = deduped.slice(skip, skip + pageSize);
    return paginatedResponse(pageRows, deduped.length, page, pageSize);
  }
}

let searchService: AreaSearchService | null = null;

export function getAreaSearchService(): AreaSearchService {
  if (!searchService) searchService = new AreaSearchService();
  return searchService;
}
