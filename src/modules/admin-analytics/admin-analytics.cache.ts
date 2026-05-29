import { CACHE_TTL_MS } from './admin-analytics.constants.js';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = CACHE_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function buildCacheKey(namespace: string, parts: Record<string, string | number | undefined>): string {
  const sorted = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ''}`)
    .join('&');
  return `${namespace}:${sorted}`;
}

export function clearAnalyticsCache(): void {
  store.clear();
}
