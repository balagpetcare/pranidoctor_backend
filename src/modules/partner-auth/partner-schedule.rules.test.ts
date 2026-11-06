import { describe, expect, it } from 'vitest';

import { checkSchedule, dhakaNow, isWithinSchedule } from './partner-schedule.rules.js';

describe('checkSchedule', () => {
  it('accepts and sorts valid slots', () => {
    const r = checkSchedule([
      { weekday: 2, startMinute: 840, endMinute: 1020 },
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slots[0]!.weekday).toBe(1);
  });
  it('rejects end before start', () => {
    expect(checkSchedule([{ weekday: 1, startMinute: 600, endMinute: 600 }]).ok).toBe(false);
  });
  it('rejects too-short slots', () => {
    expect(checkSchedule([{ weekday: 1, startMinute: 600, endMinute: 610 }]).ok).toBe(false);
  });
  it('rejects overlap on the same day only', () => {
    expect(
      checkSchedule([
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 1, startMinute: 700, endMinute: 800 },
      ]).ok,
    ).toBe(false);
    expect(
      checkSchedule([
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 2, startMinute: 700, endMinute: 800 },
      ]).ok,
    ).toBe(true);
  });
  it('allows touching slots', () => {
    expect(
      checkSchedule([
        { weekday: 1, startMinute: 600, endMinute: 720 },
        { weekday: 1, startMinute: 720, endMinute: 800 },
      ]).ok,
    ).toBe(true);
  });
  it('rejects more than 4 slots a day', () => {
    const slots = [0, 1, 2, 3, 4].map((i) => ({ weekday: 1, startMinute: i * 120, endMinute: i * 120 + 60 }));
    expect(checkSchedule(slots).ok).toBe(false);
  });
  it('rejects bad weekday', () => {
    expect(checkSchedule([{ weekday: 7, startMinute: 0, endMinute: 60 }]).ok).toBe(false);
  });
});

describe('isWithinSchedule / dhakaNow', () => {
  const slots = [{ weekday: 1, startMinute: 540, endMinute: 720 }];
  it('is inclusive of start, exclusive of end', () => {
    expect(isWithinSchedule(slots, 1, 540)).toBe(true);
    expect(isWithinSchedule(slots, 1, 720)).toBe(false);
    expect(isWithinSchedule(slots, 2, 600)).toBe(false);
  });
  it('converts UTC to Dhaka (+6h) across midnight', () => {
    // Sun 2026-11-08 20:00Z → Mon 02:00 Dhaka
    expect(dhakaNow(new Date('2026-11-08T20:00:00Z'))).toEqual({ weekday: 1, minute: 120 });
  });
});
