const DEFAULT_TTL_MS = 60_000;

type CacheEntry<T> = { value: T; expiresAt: number };

const snapshotCache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = snapshotCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    snapshotCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  snapshotCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateSettingsCache(scopeKey?: string): void {
  if (!scopeKey) {
    snapshotCache.clear();
    return;
  }
  for (const key of snapshotCache.keys()) {
    if (key.startsWith(`settings:${scopeKey}`)) {
      snapshotCache.delete(key);
    }
  }
}

export function resetSettingsCacheForTests(): void {
  snapshotCache.clear();
}
