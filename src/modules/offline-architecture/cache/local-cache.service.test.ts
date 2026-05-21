import { describe, expect, it } from 'vitest';

import { getLocalCacheService } from './local-cache.service.js';

describe('local-cache', () => {
  it('expires area cache after 7 days', () => {
    const svc = getLocalCacheService();
    const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(svc.isExpired(stale, 'AREA_DATA')).toBe(true);
  });

  it('never evicts pending entries', () => {
    const svc = getLocalCacheService();
    const evict = svc.selectEvictionCandidates(
      [
        {
          key: 'pending:1',
          cachedAt: new Date(0).toISOString(),
          entityType: 'CASE_DRAFT',
          pending: true,
        },
        {
          key: 'old:1',
          cachedAt: new Date(0).toISOString(),
          entityType: 'AREA_DATA',
          pending: false,
        },
      ],
      1024,
      4096,
    );
    expect(evict).not.toContain('pending:1');
  });
});
