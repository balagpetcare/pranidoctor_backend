import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOrSet = vi.fn(async (_key: string, loader: () => Promise<unknown>) => loader());
const delPattern = vi.fn(async () => 2);

vi.mock('../../../infra/cache/cache.service.js', () => ({
  getCacheService: () => ({
    getOrSet,
    delPattern,
  }),
}));

import { AreaCacheService } from './area-cache.service.js';

describe('area-cache.service', () => {
  beforeEach(() => {
    getOrSet.mockClear();
    delPattern.mockClear();
  });

  it('delegates hierarchy reads through cache getOrSet', async () => {
    const service = new AreaCacheService();
    const payload = { data: [{ id: '1' }], meta: { total: 1 } };

    const result = await service.getDivisions(1, 20, async () => payload);

    expect(result).toEqual(payload);
    expect(getOrSet).toHaveBeenCalledOnce();
  });

  it('invalidates all keys via pattern delete', async () => {
    const service = new AreaCacheService();
    const removed = await service.invalidateAll();

    expect(removed).toBe(2);
    expect(delPattern).toHaveBeenCalledWith('area:v1:*');
  });
});
