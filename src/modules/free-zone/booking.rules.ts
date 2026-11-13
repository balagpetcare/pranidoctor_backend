/** Pure rules for booking a doctor's free slot. */
export const MAX_UPCOMING_BOOKINGS = 3;

export type BookingCheckInput = {
  now: Date;
  slotStartsAt: Date;
  capacity: number;
  bookedCount: number;
  alreadyBooked: boolean;
  myUpcomingCount: number;
};

export type BookingCheck = { ok: true } | { ok: false; code: string; message: string };

export function checkBooking(i: BookingCheckInput): BookingCheck {
  if (i.slotStartsAt.getTime() <= i.now.getTime()) {
    return { ok: false, code: 'SLOT_STARTED', message: 'এই স্লটের সময় শুরু হয়ে গেছে।' };
  }
  if (i.alreadyBooked) return { ok: false, code: 'ALREADY_BOOKED', message: 'আপনি এই স্লট আগেই বুক করেছেন।' };
  if (i.bookedCount >= i.capacity) return { ok: false, code: 'SLOT_FULL', message: 'এই স্লটের সব সিট পূর্ণ।' };
  if (i.myUpcomingCount >= MAX_UPCOMING_BOOKINGS) {
    return { ok: false, code: 'TOO_MANY_BOOKINGS', message: `একসাথে সর্বোচ্চ ${MAX_UPCOMING_BOOKINGS}টি স্লট বুক করা যায়।` };
  }
  return { ok: true };
}

export function canCancelBooking(now: Date, slotStartsAt: Date): boolean {
  return slotStartsAt.getTime() > now.getTime();
}
