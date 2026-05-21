import { describe, expect, it } from 'vitest';

import {
  computeNextRetryAt,
  isEligibleForRetry,
  shouldMoveToDeadQueue,
} from './retry-engine.js';

describe('retry-engine', () => {
  it('computes exponential backoff capped at max', () => {
    const first = computeNextRetryAt(1, 0);
    const capped = computeNextRetryAt(8, 0);
    expect(first.getTime()).toBe(30_000);
    expect(capped.getTime()).toBe(3_600_000);
  });

  it('moves to dead queue after max attempts', () => {
    expect(shouldMoveToDeadQueue(5)).toBe(true);
    expect(shouldMoveToDeadQueue(4)).toBe(false);
  });

  it('blocks infinite retry on dead status', () => {
    expect(isEligibleForRetry('DEAD', null)).toBe(false);
  });

  it('allows retry when nextRetryAt elapsed', () => {
    const past = new Date(Date.now() - 1000);
    expect(isEligibleForRetry('FAILED', past)).toBe(true);
  });
});
