import { describe, expect, it } from 'vitest';

import { canMove, checkPeriod, rankWinners } from './reward.rules.js';

const base = {
  title: 'নভেম্বর পুরস্কার',
  startsAt: new Date('2026-11-01T00:00:00Z'),
  endsAt: new Date('2026-12-01T00:00:00Z'),
  topN: 3,
  minPoints: 10,
  prizes: [{ rank: 1, title: 'ট্রফি' }],
};

describe('checkPeriod', () => {
  it('accepts a valid period', () => expect(checkPeriod(base)).toBeNull());
  it('rejects bad dates, topN, duplicate or out-of-range prize ranks', () => {
    expect(checkPeriod({ ...base, endsAt: base.startsAt })).not.toBeNull();
    expect(checkPeriod({ ...base, topN: 0 })).not.toBeNull();
    expect(checkPeriod({ ...base, prizes: [{ rank: 4, title: 'x1' }] })).not.toBeNull();
    expect(checkPeriod({ ...base, prizes: [{ rank: 1, title: 'ab' }, { rank: 1, title: 'cd' }] })).not.toBeNull();
    expect(checkPeriod({ ...base, title: 'ab' })).not.toBeNull();
  });
});

describe('rankWinners', () => {
  const rows = [
    { userId: 'c', points: 30 },
    { userId: 'a', points: 50 },
    { userId: 'b', points: 50 },
    { userId: 'd', points: 5 },
  ];
  it('orders by points then userId, applies topN and minPoints', () => {
    expect(rankWinners(rows, 3, 10).map((r) => `${r.rank}:${r.userId}`)).toEqual(['1:a', '2:b', '3:c']);
    expect(rankWinners(rows, 10, 10)).toHaveLength(3);
    expect(rankWinners(rows, 2, 40).map((r) => r.userId)).toEqual(['a', 'b']);
  });
});

describe('canMove', () => {
  it('allows forward moves only', () => {
    expect(canMove('DRAFT', 'ACTIVE')).toBe(true);
    expect(canMove('ACTIVE', 'CLOSED')).toBe(true);
    expect(canMove('CLOSED', 'ACTIVE')).toBe(false);
    expect(canMove('ACTIVE', 'DRAFT')).toBe(false);
  });
});
