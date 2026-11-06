import { getCacheService, type CacheService } from '../../infra/cache/index.js';

/**
 * In-process single-flight: when thousands of clients ask for the same cold key at once,
 * only one request hits the database; the rest await the same promise.
 */
const inflight = new Map<string, Promise<unknown>>();

function safeCache(): CacheService | null {
  try {
    return getCacheService();
  } catch {
    return null; // Redis/cache not initialised (tests, degraded mode) → just run the loader.
  }
}

export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const run = (async (): Promise<T> => {
    const cache = safeCache();
    if (cache) {
      const hit = await cache.get<T>(key);
      if (hit !== null) return hit;
    }
    const value = await loader();
    if (cache) await cache.set(key, value, ttlSeconds);
    return value;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, run);
  return run;
}

export function discoveryCacheKey(...parts: Array<string | number | boolean | undefined>): string {
  return ['discovery', ...parts.map((p) => (p === undefined ? '-' : String(p)))].join(':');
}
