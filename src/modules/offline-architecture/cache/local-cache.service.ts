import { OFFLINE_CACHE_TTL_MS } from '../offline-architecture.types.js';

export class LocalCacheService {
  readonly name = 'LocalCacheService';

  getTtlMs(entityType: string): number {
    return OFFLINE_CACHE_TTL_MS[entityType] ?? 24 * 60 * 60 * 1000;
  }

  isExpired(cachedAtIso: string, entityType: string, now = Date.now()): boolean {
    const cachedAt = Date.parse(cachedAtIso);
    if (Number.isNaN(cachedAt)) return true;
    return now - cachedAt > this.getTtlMs(entityType);
  }

  /** Eviction candidates — never includes pending sync keys. */
  selectEvictionCandidates(
    entries: Array<{ key: string; cachedAt: string; entityType: string; pending: boolean }>,
    quotaBytes: number,
    estimatedSizeBytes: number,
  ): string[] {
    if (estimatedSizeBytes <= quotaBytes) return [];

    const candidates = entries
      .filter((e) => !e.pending)
      .sort((a, b) => Date.parse(a.cachedAt) - Date.parse(b.cachedAt));

    const evict: string[] = [];
    let size = estimatedSizeBytes;
    for (const entry of candidates) {
      if (size <= quotaBytes) break;
      if (this.isExpired(entry.cachedAt, entry.entityType)) {
        evict.push(entry.key);
        size = Math.max(0, size - 4096);
      }
    }
    return evict;
  }
}

let service: LocalCacheService | null = null;

export function getLocalCacheService(): LocalCacheService {
  if (!service) service = new LocalCacheService();
  return service;
}
