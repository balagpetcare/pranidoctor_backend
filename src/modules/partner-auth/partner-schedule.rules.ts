/** Pure validation for the weekly availability schedule (minutes from local midnight). */

export const MAX_SLOTS_PER_DAY = 4;
export const MIN_SLOT_MINUTES = 30;

export type SlotInput = { weekday: number; startMinute: number; endMinute: number };

export type SlotCheck = { ok: true; slots: SlotInput[] } | { ok: false; message: string };

const DAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export const dayNameBn = (weekday: number): string => DAYS_BN[weekday] ?? '';

/** Validates and returns the slots sorted by day then start. Overlaps are rejected. */
export function checkSchedule(input: SlotInput[]): SlotCheck {
  for (const s of input) {
    if (!Number.isInteger(s.weekday) || s.weekday < 0 || s.weekday > 6) {
      return { ok: false, message: 'বারের মান সঠিক নয়।' };
    }
    if (
      !Number.isInteger(s.startMinute) ||
      !Number.isInteger(s.endMinute) ||
      s.startMinute < 0 ||
      s.endMinute > 1440 ||
      s.startMinute >= s.endMinute
    ) {
      return { ok: false, message: `${dayNameBn(s.weekday)}: শুরুর সময় শেষের সময়ের আগে হতে হবে।` };
    }
    if (s.endMinute - s.startMinute < MIN_SLOT_MINUTES) {
      return { ok: false, message: `${dayNameBn(s.weekday)}: কমপক্ষে ${MIN_SLOT_MINUTES} মিনিটের স্লট দিন।` };
    }
  }
  const sorted = [...input].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev && prev.weekday === cur.weekday && cur.startMinute < prev.endMinute) {
      return { ok: false, message: `${dayNameBn(cur.weekday)}: সময়ের স্লট একে অপরের সাথে মিলে গেছে।` };
    }
  }
  for (let d = 0; d < 7; d += 1) {
    if (sorted.filter((s) => s.weekday === d).length > MAX_SLOTS_PER_DAY) {
      return { ok: false, message: `${dayNameBn(d)}: দিনে সর্বোচ্চ ${MAX_SLOTS_PER_DAY}টি স্লট দেওয়া যায়।` };
    }
  }
  return { ok: true, slots: sorted };
}

/** Whether the schedule covers the given local weekday/minute. No slots → never "scheduled". */
export function isWithinSchedule(slots: SlotInput[], weekday: number, minute: number): boolean {
  return slots.some((s) => s.weekday === weekday && minute >= s.startMinute && minute < s.endMinute);
}

/** Current weekday/minute in Asia/Dhaka (UTC+6, no DST). */
export function dhakaNow(now: Date = new Date()): { weekday: number; minute: number } {
  const local = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return { weekday: local.getUTCDay(), minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
}
