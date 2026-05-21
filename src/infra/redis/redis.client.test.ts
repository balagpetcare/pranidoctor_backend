import { describe, expect, it } from 'vitest';

import { checkRedisConnection, isRedisInitialized } from './redis.client.js';

describe('redis.client', () => {
  it('reports not initialized without throwing', async () => {
    expect(isRedisInitialized()).toBe(false);

    const result = await checkRedisConnection();

    expect(result.healthy).toBe(false);
    expect(result.latency).toBe(0);
    expect(result.error).toContain('not initialized');
  });
});
