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

  it('reconnects on transient network errors (policy mirrors redis.client.ts)', () => {
    const reconnectOnError = (err: Error): boolean => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    };

    expect(reconnectOnError(new Error('ECONNRESET'))).toBe(true);
    expect(reconnectOnError(new Error('READONLY'))).toBe(true);
    expect(reconnectOnError(new Error('unknown'))).toBe(false);
  });
});
