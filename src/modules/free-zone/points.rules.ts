/** Default point values per server-verified event. Admin overrides live in Setting `FREE_ZONE_POINTS`. */
export type PointValues = {
  FREE_CONSULTATION_COMPLETED: number;
  FIVE_STAR_RATING: number;
};

export const POINT_EVENTS: Readonly<PointValues> = Object.freeze({
  FREE_CONSULTATION_COMPLETED: 10,
  FIVE_STAR_RATING: 5,
});

export type PointEvent = keyof PointValues;

export function pointsFor(event: PointEvent, values: PointValues = POINT_EVENTS): number {
  return values[event];
}

/** Merges stored JSON over defaults; each value must be an integer 0..1000, otherwise the default is kept. */
export function parsePointValues(json: unknown): PointValues {
  const o = json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const pick = (k: PointEvent) => {
    const v = o[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : POINT_EVENTS[k];
  };
  return { FREE_CONSULTATION_COMPLETED: pick('FREE_CONSULTATION_COMPLETED'), FIVE_STAR_RATING: pick('FIVE_STAR_RATING') };
}

/** Rating is valid only from the request's own customer, 1..5, for a completed request. */
export function checkRating(input: { rating: number; status: string; byRequestOwner: boolean }): string | null {
  if (!input.byRequestOwner) return 'শুধু অনুরোধকারী গ্রাহকই রেটিং দিতে পারবেন।';
  if (input.status !== 'COMPLETED') return 'পরামর্শ সম্পন্ন হওয়ার পরই রেটিং দেওয়া যাবে।';
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return 'রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে।';
  return null;
}

export type FreeSlotInput = { startsAt: Date; endsAt: Date; capacity: number; mode: string };

export function checkFreeSlot(i: FreeSlotInput, now: Date): string | null {
  if (!(i.startsAt < i.endsAt)) return 'শেষ সময় শুরুর পরে হতে হবে।';
  if (i.startsAt.getTime() < now.getTime()) return 'অতীত সময়ে স্লট দেওয়া যাবে না।';
  const mins = (i.endsAt.getTime() - i.startsAt.getTime()) / 60000;
  if (mins < 10 || mins > 240) return 'স্লট ১০ মিনিট থেকে ৪ ঘণ্টার মধ্যে হতে হবে।';
  if (!Number.isInteger(i.capacity) || i.capacity < 1 || i.capacity > 50) return 'ধারণক্ষমতা ১ থেকে ৫০ এর মধ্যে হতে হবে।';
  if (!['TEXT', 'AUDIO', 'VIDEO'].includes(i.mode)) return 'মোড TEXT, AUDIO বা VIDEO হতে হবে।';
  return null;
}

export type LeaderboardPeriod = 'week' | 'month';

/** Start of the current leaderboard period in Asia/Dhaka (UTC+6). Week starts on Saturday. */
export function periodStart(period: LeaderboardPeriod, now: Date): Date {
  const DHAKA = 6 * 3_600_000;
  const l = new Date(now.getTime() + DHAKA);
  if (period === 'month') return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - DHAKA);
  const dayStart = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
  const sinceSaturday = (l.getUTCDay() + 1) % 7; // Sat=0 … Fri=6
  return new Date(dayStart - sinceSaturday * 86_400_000 - DHAKA);
}

/** Average from `RATING_<n>` ledger event types. */
export function averageRating(counts: { eventType: string; count: number }[]): { avg: number | null; count: number } {
  let sum = 0;
  let n = 0;
  for (const c of counts) {
    const m = /^RATING_([1-5])$/.exec(c.eventType);
    if (!m) continue;
    sum += Number(m[1]) * c.count;
    n += c.count;
  }
  return { avg: n === 0 ? null : Math.round((sum / n) * 10) / 10, count: n };
}
