export const AREA_CACHE_VERSION = 'v1';

export const AREA_CACHE_TTL = {
  hierarchy: 86400,
  search: 3600,
} as const;

export function areaCacheKey(parts: string[]): string {
  return `area:${AREA_CACHE_VERSION}:${parts.join(':')}`;
}

export function divisionsCacheKey(page = 1, pageSize = 20): string {
  return areaCacheKey(['divisions', String(page), String(pageSize)]);
}

export function districtsCacheKey(divisionId: string, page = 1, pageSize = 20): string {
  return areaCacheKey(['districts', divisionId, String(page), String(pageSize)]);
}

export function upazilasCacheKey(districtId: string, page = 1, pageSize = 20): string {
  return areaCacheKey(['upazilas', districtId, String(page), String(pageSize)]);
}

export function unionsCacheKey(upazilaId: string, page = 1, pageSize = 20): string {
  return areaCacheKey(['unions', upazilaId, String(page), String(pageSize)]);
}

export function villagesCacheKey(unionId: string, page = 1, pageSize = 20): string {
  return areaCacheKey(['villages', unionId, String(page), String(pageSize)]);
}

export function searchCacheKey(payload: Record<string, string | number | undefined>): string {
  const normalized = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k] ?? ''}`)
    .join('|');
  return areaCacheKey(['search', normalized]);
}

export function areaCacheInvalidationPattern(): string {
  return `area:${AREA_CACHE_VERSION}:*`;
}
