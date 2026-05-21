/**
 * Pure billing totals for Prani Doctor invoices (BDT MVP).
 * Commission applies to service fee only (after discount allocated to service fee).
 */

export type BillingTotalsInput = {
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  /** Total discount applied to the invoice (maps to `BillingRecord.discountAmount`). */
  discount: number;
  /** Decimal fraction, e.g. 0.1 for 10%. */
  commissionRate: number;
  /**
   * Portion of `discount` that reduces the service fee component for commission purposes.
   * When omitted, defaults to discount allocated to service first: `min(max(discount, 0), serviceFee)`.
   */
  discountAppliedToServiceFee?: number;
};

export type BillingTotalsResult = {
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  discount: number;
  subtotal: number;
  totalCollected: number;
  commissionBase: number;
  platformCommission: number;
  providerPayout: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function nonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

/**
 * Computes subtotal, collected total, commission on service fee, and provider payout.
 *
 * Formulas:
 * - subtotal = serviceFee + travelCost + medicineCost
 * - totalCollected = max(subtotal - discount, 0)
 * - commissionBase = max(serviceFee - discountAppliedToServiceFee, 0)
 * - platformCommission = commissionBase * commissionRate
 * - providerPayout = totalCollected - platformCommission
 */
export function calculateBillingTotals(input: BillingTotalsInput): BillingTotalsResult {
  const serviceFee = roundMoney(nonNeg(input.serviceFee));
  const travelCost = roundMoney(nonNeg(input.travelCost));
  const medicineCost = roundMoney(nonNeg(input.medicineCost));
  const discount = roundMoney(nonNeg(input.discount));

  const subtotal = roundMoney(serviceFee + travelCost + medicineCost);
  const totalCollected = roundMoney(Math.max(subtotal - discount, 0));

  const rate = Number.isFinite(input.commissionRate)
    ? Math.min(1, Math.max(0, input.commissionRate))
    : 0;

  const rawAllocated =
    input.discountAppliedToServiceFee !== undefined
      ? input.discountAppliedToServiceFee
      : Math.min(discount, serviceFee);
  const discountAppliedToServiceFee = roundMoney(nonNeg(rawAllocated));

  const commissionBase = roundMoney(
    Math.max(serviceFee - discountAppliedToServiceFee, 0),
  );
  const platformCommission = roundMoney(commissionBase * rate);
  /** Never negative; guards float noise and legacy inconsistent rows if recomputed. */
  const providerPayout = roundMoney(Math.max(0, totalCollected - platformCommission));

  return {
    serviceFee,
    travelCost,
    medicineCost,
    discount,
    subtotal,
    totalCollected,
    commissionBase,
    platformCommission,
    providerPayout,
  };
}
