import { describe, expect, it } from 'vitest';

import { AreaSearchService } from './area-search.service.js';

describe('area-search.service', () => {
  it('returns empty paginated result for blank query', async () => {
    const service = new AreaSearchService();
    const result = await service.search({ q: '   ' });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(result.meta.page).toBe(1);
  });
});
