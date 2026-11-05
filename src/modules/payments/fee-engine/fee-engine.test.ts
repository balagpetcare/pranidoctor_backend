import { describe, it, expect } from 'vitest';
import {
  calculateServiceFee,
  DEFAULT_FEE_RATES,
  type FeeRates,
} from './fee-engine.js';

describe('calculateServiceFee (PAY-03)', () => {
  it('takes one combined 25% from the provider share: 500 BDT -> 125 deducted, 375 payout', () => {
    const r = calculateServiceFee(500);
    expect(r.totalFeeBdt).toBe(125);
    expect(r.doctorPayoutBdt).toBe(375);
    expect(r.minimumApplied).toBe(false);
  });

  it('applies the 50 BDT minimum: 100 BDT -> 50 applied, not 25', () => {
    const r = calculateServiceFee(100);
    expect(r.percentageFeeBdt).toBe(25);
    expect(r.totalFeeBdt).toBe(50);
    expect(r.minimumApplied).toBe(true);
    expect(r.doctorPayoutBdt).toBe(50);
  });

  it('splits the fee into gateway 5% and platform 20% parts', () => {
    const r = calculateServiceFee(500);
    expect(r.gatewayFeeBdt).toBe(25);
    expect(r.platformFeeBdt).toBe(100);
    expect(r.gatewayFeeBdt + r.platformFeeBdt).toBe(r.totalFeeBdt);
  });

  it('never charges more than the amount when the amount is below the minimum', () => {
    const r = calculateServiceFee(30);
    expect(r.totalFeeBdt).toBe(30);
    expect(r.doctorPayoutBdt).toBe(0);
  });

  it('keeps the boundary: exactly 200 BDT gives 50 (percentage equals minimum)', () => {
    const r = calculateServiceFee(200);
    expect(r.totalFeeBdt).toBe(50);
    expect(r.minimumApplied).toBe(false);
  });

  it('returns zeros for zero, negative or non-finite amounts', () => {
    for (const amount of [0, -10, Number.NaN]) {
      const r = calculateServiceFee(amount);
      expect(r.totalFeeBdt).toBe(0);
      expect(r.doctorPayoutBdt).toBe(0);
    }
  });

  it('uses admin-changed rates for new calculations without code change', () => {
    const rates: FeeRates = { gatewayRate: 0.03, platformRate: 0.1, minimumChargeBdt: 50 };
    const r = calculateServiceFee(1000, rates);
    expect(r.totalFeeBdt).toBe(130);
    expect(r.doctorPayoutBdt).toBe(870);
    expect(r.gatewayFeeBdt).toBe(30);
  });

  it('rejects invalid rate settings', () => {
    expect(() => calculateServiceFee(500, { ...DEFAULT_FEE_RATES, gatewayRate: -0.01 })).toThrow(RangeError);
    expect(() => calculateServiceFee(500, { ...DEFAULT_FEE_RATES, platformRate: 0.95, gatewayRate: 0.05 })).toThrow(RangeError);
    expect(() => calculateServiceFee(500, { ...DEFAULT_FEE_RATES, minimumChargeBdt: Number.NaN })).toThrow(RangeError);
  });
});
