import { describe, expect, it } from 'vitest';

import { parsePointValues, averageRating, checkFreeSlot, checkRating, periodStart, pointsFor } from './points.rules.js';

describe('points', () => {
  it('awards 10 for completed free consultation', () => {
    expect(pointsFor('FREE_CONSULTATION_COMPLETED')).toBe(10);
  });
});

describe('checkRating', () => {
  it('accepts owner rating on completed request', () => {
    expect(checkRating({ rating: 5, status: 'COMPLETED', byRequestOwner: true })).toBeNull();
  });
  it('rejects non-owner, incomplete and out-of-range', () => {
    expect(checkRating({ rating: 5, status: 'COMPLETED', byRequestOwner: false })).not.toBeNull();
    expect(checkRating({ rating: 5, status: 'IN_PROGRESS', byRequestOwner: true })).not.toBeNull();
    expect(checkRating({ rating: 6, status: 'COMPLETED', byRequestOwner: true })).not.toBeNull();
    expect(checkRating({ rating: 0, status: 'COMPLETED', byRequestOwner: true })).not.toBeNull();
  });
});

describe('checkFreeSlot', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const ok = { startsAt: new Date('2026-11-10T04:00:00Z'), endsAt: new Date('2026-11-10T04:30:00Z'), capacity: 3, mode: 'VIDEO' };
  it('accepts a valid slot', () => expect(checkFreeSlot(ok, now)).toBeNull());
  it('rejects past, bad length, capacity, mode', () => {
    expect(checkFreeSlot({ ...ok, startsAt: new Date('2026-11-09T04:00:00Z'), endsAt: new Date('2026-11-09T04:30:00Z') }, now)).not.toBeNull();
    expect(checkFreeSlot({ ...ok, endsAt: new Date('2026-11-10T04:05:00Z') }, now)).not.toBeNull();
    expect(checkFreeSlot({ ...ok, capacity: 0 }, now)).not.toBeNull();
    expect(checkFreeSlot({ ...ok, mode: 'FAX' }, now)).not.toBeNull();
  });
});

describe('periodStart', () => {
  it('month starts at Dhaka month start', () => {
    expect(periodStart('month', new Date('2026-11-09T10:00:00Z')).toISOString()).toBe('2026-10-31T18:00:00.000Z');
  });
  it('week starts on Saturday (Dhaka)', () => {
    // 2026-11-09 is Monday -> Saturday 2026-11-07 00:00 Dhaka = 2026-11-06T18:00Z
    expect(periodStart('week', new Date('2026-11-09T10:00:00Z')).toISOString()).toBe('2026-11-06T18:00:00.000Z');
    // Saturday itself
    expect(periodStart('week', new Date('2026-11-07T10:00:00Z')).toISOString()).toBe('2026-11-06T18:00:00.000Z');
  });
});

describe('averageRating', () => {
  it('averages RATING_n rows and ignores others', () => {
    expect(averageRating([{ eventType: 'RATING_5', count: 2 }, { eventType: 'RATING_4', count: 2 }, { eventType: 'FIVE_STAR_RATING', count: 9 }])).toEqual({ avg: 4.5, count: 4 });
    expect(averageRating([])).toEqual({ avg: null, count: 0 });
  });
});

describe('parsePointValues', () => {
  it('uses defaults and ignores invalid values', () => {
    expect(parsePointValues(null)).toEqual({ FREE_CONSULTATION_COMPLETED: 10, FIVE_STAR_RATING: 5 });
    expect(parsePointValues({ FREE_CONSULTATION_COMPLETED: 20, FIVE_STAR_RATING: -1 })).toEqual({ FREE_CONSULTATION_COMPLETED: 20, FIVE_STAR_RATING: 5 });
  });
});
