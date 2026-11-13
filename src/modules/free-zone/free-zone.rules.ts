/**
 * Free Zone quota rules (pure, Asia/Dhaka time).
 *
 * Owner-approved policy:
 *  - first 30 days from a customer's first free request: up to 2 free consultations
 *  - afterwards: 1 free consultation per calendar month
 *  - never 2 requests on the same calendar day
 *  - live rooms: 4 video tiles in total (host included)
 * Emergency requests are exempt from the quota (owner-confirmed): up to `emergencyDailyFree` free per Dhaka day, then paid.
 */

export type FreeZonePolicy = {
  /** Kill switch for staged rollout. */
  enabled: boolean;
  welcomeDays: number;
  welcomeLimit: number;
  monthlyLimit: number;
  dailyLimit: number;
  emergencyExempt: boolean;
  /** Free emergency requests per Dhaka day; beyond this the customer uses the paid emergency service. */
  emergencyDailyFree: number;
  liveMaxTiles: number;
  /** Open reports on one comment before it is auto-hidden pending admin review. */
  commentReportAutoHide: number;
};

export const DEFAULT_FREE_ZONE_POLICY: Readonly<FreeZonePolicy> = Object.freeze({
  enabled: true,
  welcomeDays: 30,
  welcomeLimit: 2,
  monthlyLimit: 1,
  dailyLimit: 1,
  emergencyExempt: true,
  emergencyDailyFree: 2,
  liveMaxTiles: 4,
  commentReportAutoHide: 3,
});

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/** Merges stored JSON over defaults; invalid fields fall back silently. */
export function parseFreeZonePolicy(json: unknown): FreeZonePolicy {
  const d = DEFAULT_FREE_ZONE_POLICY;
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { ...d };
  const o = json as Record<string, unknown>;
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
    welcomeDays: int(o.welcomeDays, 1, 365) ?? d.welcomeDays,
    welcomeLimit: int(o.welcomeLimit, 0, 100) ?? d.welcomeLimit,
    monthlyLimit: int(o.monthlyLimit, 0, 100) ?? d.monthlyLimit,
    dailyLimit: int(o.dailyLimit, 1, 20) ?? d.dailyLimit,
    emergencyExempt: typeof o.emergencyExempt === 'boolean' ? o.emergencyExempt : d.emergencyExempt,
    emergencyDailyFree: int(o.emergencyDailyFree, 0, 20) ?? d.emergencyDailyFree,
    liveMaxTiles: int(o.liveMaxTiles, 2, 9) ?? d.liveMaxTiles,
    commentReportAutoHide: int(o.commentReportAutoHide, 1, 50) ?? d.commentReportAutoHide,
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DHAKA = 6 * HOUR;

const dayIndex = (d: Date) => Math.floor((d.getTime() + DHAKA) / DAY);
const monthIndex = (d: Date) => {
  const l = new Date(d.getTime() + DHAKA);
  return l.getUTCFullYear() * 12 + l.getUTCMonth();
};
const startOfNextDay = (d: Date) => new Date((dayIndex(d) + 1) * DAY - DHAKA);
const startOfNextMonth = (d: Date) => {
  const l = new Date(d.getTime() + DHAKA);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + 1, 1) - DHAKA);
};

/** Dhaka-day index helper for callers that need the same day boundary. */
export const dhakaDayIndex = dayIndex;

export type PastFreeRequest = { at: Date; emergency: boolean };

export type QuotaResult =
  | { ok: true; exempt: boolean }
  | {
      ok: false;
      code: 'DAILY_LIMIT' | 'WELCOME_LIMIT' | 'MONTHLY_LIMIT';
      message: string;
      /** When the customer may try again. */
      nextAvailableAt: Date;
    };

/** Decides whether a customer may submit another free consultation request right now. */
export function checkFreeQuota(input: {
  now: Date;
  policy: FreeZonePolicy;
  past: PastFreeRequest[];
  isEmergency: boolean;
}): QuotaResult {
  const { now, policy } = input;
  if (input.isEmergency && policy.emergencyExempt) return { ok: true, exempt: true };

  const counted = input.past
    .filter((p) => !(p.emergency && policy.emergencyExempt))
    .map((p) => p.at)
    .sort((a, b) => a.getTime() - b.getTime());
  if (counted.length === 0) return { ok: true, exempt: false };

  const sameDay = counted.filter((at) => dayIndex(at) === dayIndex(now)).length;
  if (sameDay >= policy.dailyLimit) {
    return {
      ok: false,
      code: 'DAILY_LIMIT',
      message: 'আজ আপনি আগেই একটি ফ্রি পরামর্শ চেয়েছেন। আগামীকাল আবার চেষ্টা করুন।',
      nextAvailableAt: startOfNextDay(now),
    };
  }

  const welcomeEnd = new Date(counted[0]!.getTime() + policy.welcomeDays * DAY);
  if (now.getTime() < welcomeEnd.getTime()) {
    const used = counted.filter((at) => at.getTime() < welcomeEnd.getTime()).length;
    if (used >= policy.welcomeLimit) {
      return {
        ok: false,
        code: 'WELCOME_LIMIT',
        message: `প্রথম ${policy.welcomeDays} দিনে ${policy.welcomeLimit}টি ফ্রি পরামর্শ ব্যবহার হয়ে গেছে। এরপর প্রতি মাসে ${policy.monthlyLimit}টি পাবেন।`,
        nextAvailableAt: welcomeEnd,
      };
    }
    return { ok: true, exempt: false };
  }

  const usedThisMonth = counted.filter(
    (at) => at.getTime() >= welcomeEnd.getTime() && monthIndex(at) === monthIndex(now),
  ).length;
  if (usedThisMonth >= policy.monthlyLimit) {
    return {
      ok: false,
      code: 'MONTHLY_LIMIT',
      message: `এই মাসের ${policy.monthlyLimit}টি ফ্রি পরামর্শ ব্যবহার হয়ে গেছে। আগামী মাসে আবার পাবেন।`,
      nextAvailableAt: startOfNextMonth(now),
    };
  }
  return { ok: true, exempt: false };
}
