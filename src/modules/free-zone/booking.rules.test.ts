import { describe, expect, it } from 'vitest';

import { canCancelBooking, checkBooking } from './booking.rules.js';

const now = new Date('2026-11-20T00:00:00Z');
const future = new Date('2026-11-21T00:00:00Z');
const base = { now, slotStartsAt: future, capacity: 2, bookedCount: 0, alreadyBooked: false, myUpcomingCount: 0 };

describe('checkBooking', () => {
  it('allows a normal booking', () => expect(checkBooking(base).ok).toBe(true));
  it('rejects started slot', () => {
    const r = checkBooking({ ...base, slotStartsAt: new Date('2026-11-19T00:00:00Z') });
    expect(r).toMatchObject({ ok: false, code: 'SLOT_STARTED' });
  });
  it('rejects duplicate', () => expect(checkBooking({ ...base, alreadyBooked: true })).toMatchObject({ code: 'ALREADY_BOOKED' }));
  it('rejects full slot', () => expect(checkBooking({ ...base, bookedCount: 2 })).toMatchObject({ code: 'SLOT_FULL' }));
  it('rejects more than 3 upcoming', () => expect(checkBooking({ ...base, myUpcomingCount: 3 })).toMatchObject({ code: 'TOO_MANY_BOOKINGS' }));
});

describe('canCancelBooking', () => {
  it('only before start', () => {
    expect(canCancelBooking(now, future)).toBe(true);
    expect(canCancelBooking(future, now)).toBe(false);
  });
});
