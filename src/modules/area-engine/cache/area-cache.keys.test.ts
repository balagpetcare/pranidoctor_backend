import { describe, expect, it } from 'vitest';

import {
  AREA_CACHE_VERSION,
  areaCacheInvalidationPattern,
  districtsCacheKey,
  searchCacheKey,
} from './area-cache.keys.js';

describe('area-cache.keys', () => {
  it('builds versioned hierarchy keys with pagination', () => {
    expect(districtsCacheKey('div1', 2, 50)).toBe(
      `area:${AREA_CACHE_VERSION}:districts:div1:2:50`,
    );
  });

  it('builds deterministic search keys', () => {
    const a = searchCacheKey({ q: 'dhaka', level: 'ALL', page: 1 });
    const b = searchCacheKey({ q: 'dhaka', level: 'ALL', page: 1 });
    expect(a).toBe(b);
  });

  it('defines invalidation pattern', () => {
    expect(areaCacheInvalidationPattern()).toBe(`area:${AREA_CACHE_VERSION}:*`);
  });
});
