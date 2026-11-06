import { type PartnerRole } from './partner-roles.js';

/**
 * AI-service (artificial insemination) fee rules. All values are meant to come
 * from admin settings; defaults below match the agreed launch terms.
 */
export interface AiFeeSettings {
  /** Flat monthly fee for AI technicians (BDT). Doctors never pay it. */
  monthlyFeeBdt: number;
  /** Fixed fee per successful AI service (BDT). Used when percent is null. */
  perServiceFeeBdt: number;
  /** When set (0–100), per-service fee becomes this percent of the service price. */
  perServiceFeePercent: number | null;
  /** Monthly fee is waived when completed services this month reach this count. */
  monthlyFeeWaiverServices: number;
}

export const DEFAULT_AI_FEE_SETTINGS: AiFeeSettings = {
  monthlyFeeBdt: 1500,
  perServiceFeeBdt: 50,
  perServiceFeePercent: null,
  monthlyFeeWaiverServices: 60,
};

/**
 * Monthly AI fee. Doctors providing AI service pay no monthly fee;
 * AI technicians pay it unless they reached the waiver threshold.
 */
export function aiMonthlyFeeFor(
  primary: PartnerRole,
  settings: AiFeeSettings,
  completedServicesThisMonth: number,
): number {
  if (primary === 'DOCTOR') return 0;
  if (primary !== 'AI_TECHNICIAN') return 0;
  if (completedServicesThisMonth >= settings.monthlyFeeWaiverServices) return 0;
  return settings.monthlyFeeBdt;
}

/** Fee charged for each successful AI service — applies to every provider (doctor or technician). */
export function aiPerServiceFeeFor(settings: AiFeeSettings, servicePriceBdt: number): number {
  const pct = settings.perServiceFeePercent;
  if (pct !== null) {
    const clamped = Math.min(100, Math.max(0, pct));
    return Math.round((servicePriceBdt * clamped) / 100);
  }
  return settings.perServiceFeeBdt;
}
