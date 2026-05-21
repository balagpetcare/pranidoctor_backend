import { describe, expect, it } from "vitest";

import { calculateBillingTotals } from "@/lib/billing-calculation";

describe("calculateBillingTotals", () => {
  it("computes commission on service fee only (medicine/travel excluded from base)", () => {
    const r = calculateBillingTotals({
      serviceFee: 500,
      travelCost: 100,
      medicineCost: 50,
      discount: 50,
      commissionRate: 0.1,
    });
    expect(r.subtotal).toBe(650);
    expect(r.totalCollected).toBe(600);
    expect(r.commissionBase).toBe(450);
    expect(r.platformCommission).toBe(45);
    expect(r.providerPayout).toBe(555);
  });

  it("uses explicit discountAppliedToServiceFee when provided", () => {
    const r = calculateBillingTotals({
      serviceFee: 500,
      travelCost: 100,
      medicineCost: 50,
      discount: 50,
      commissionRate: 0.1,
      discountAppliedToServiceFee: 0,
    });
    expect(r.commissionBase).toBe(500);
    expect(r.platformCommission).toBe(50);
    expect(r.providerPayout).toBe(550);
  });

  it("clamps totalCollected at zero when discount exceeds subtotal", () => {
    const r = calculateBillingTotals({
      serviceFee: 100,
      travelCost: 0,
      medicineCost: 0,
      discount: 200,
      commissionRate: 0.1,
    });
    expect(r.totalCollected).toBe(0);
    expect(r.commissionBase).toBe(0);
    expect(r.platformCommission).toBe(0);
    expect(r.providerPayout).toBe(0);
  });

  it("clamps commissionRate above 1.0 to 100%", () => {
    const r = calculateBillingTotals({
      serviceFee: 100,
      travelCost: 0,
      medicineCost: 0,
      discount: 0,
      commissionRate: 1.5,
    });
    expect(r.platformCommission).toBe(100);
    expect(r.providerPayout).toBe(0);
  });
});
