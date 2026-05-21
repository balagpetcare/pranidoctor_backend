import { createHash } from 'node:crypto';

import { getCacheService } from '../../../infra/cache/cache.service.js';
import { logDebug } from '../../../shared/logger/logger.js';

import {
  AREA_CACHE_TTL,
  areaCacheInvalidationPattern,
  divisionsCacheKey,
  districtsCacheKey,
  searchCacheKey,
  unionsCacheKey,
  upazilasCacheKey,
  villagesCacheKey,
} from './area-cache.keys.js';

async function withCache<T>(
  key: string,
  ttl: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const cache = getCacheService();
    return await cache.getOrSet(key, loader, ttl);
  } catch {
    logDebug('Area cache unavailable — loading from database', { key });
    return loader();
  }
}

export class AreaCacheService {
  getDivisions<T>(page: number, pageSize: number, loader: () => Promise<T>): Promise<T> {
    return withCache(divisionsCacheKey(page, pageSize), AREA_CACHE_TTL.hierarchy, loader);
  }

  getDistricts<T>(divisionId: string, page: number, pageSize: number, loader: () => Promise<T>): Promise<T> {
    return withCache(districtsCacheKey(divisionId, page, pageSize), AREA_CACHE_TTL.hierarchy, loader);
  }

  getUpazilas<T>(districtId: string, page: number, pageSize: number, loader: () => Promise<T>): Promise<T> {
    return withCache(upazilasCacheKey(districtId, page, pageSize), AREA_CACHE_TTL.hierarchy, loader);
  }

  getUnions<T>(upazilaId: string, page: number, pageSize: number, loader: () => Promise<T>): Promise<T> {
    return withCache(unionsCacheKey(upazilaId, page, pageSize), AREA_CACHE_TTL.hierarchy, loader);
  }

  getVillages<T>(unionId: string, page: number, pageSize: number, loader: () => Promise<T>): Promise<T> {
    return withCache(villagesCacheKey(unionId, page, pageSize), AREA_CACHE_TTL.hierarchy, loader);
  }

  getSearch<T>(params: Record<string, string | number | undefined>, loader: () => Promise<T>): Promise<T> {
    const hash = createHash('sha256').update(searchCacheKey(params)).digest('hex').slice(0, 16);
    return withCache(searchCacheKey({ hash, ...params }), AREA_CACHE_TTL.search, loader);
  }

  async invalidateAll(): Promise<number> {
    try {
      const cache = getCacheService();
      return await cache.delPattern(areaCacheInvalidationPattern());
    } catch {
      return 0;
    }
  }

  async warmupDivisions(page: number, pageSize: number, loader: () => Promise<unknown>): Promise<void> {
    await this.getDivisions(page, pageSize, loader);
  }
}

let cacheService: AreaCacheService | null = null;

export function getAreaCacheService(): AreaCacheService {
  if (!cacheService) cacheService = new AreaCacheService();
  return cacheService;
}
