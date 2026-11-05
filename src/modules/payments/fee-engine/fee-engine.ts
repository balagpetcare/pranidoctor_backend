/**
 * PAY-03 fee engine (pure). One combined deduction is taken at once from the
 * provider's share: gateway fee + platform fee, with a minimum charge.
 *
 * Rates are inputs so admin-editable settings can be passed in; nothing here
 * is hard-coded to a launch value except DEFAULT_FEE_RATES.
 */

export type FeeRates = {
  /** Gateway (bKash processing) share, e.g. 0.05 for 5%. */
  gatewayRate: number;
  /** Platform commission share, e.g. 0.20 for 20%. */
  platformRate: number;
  /** Minimum total fee in BDT when the percentage fee is lower. */
  minimumChargeBdt: number;
};

export const DEFAULT_FEE_RATES: Readonly<FeeRates> = Object.freeze({
  gatewayRate: 0.05,
  platformRate: 0.2,
  minimumChargeBdt: 50,
});

export type FeeBreakdown = {
  amountBdt: number;
  /** Combined rate, gateway + platform. */
  combinedRate: number;
  /** Percentage fee before the minimum is applied. */
  percentageFeeBdt: number;
  minimumApplied: boolean;
  gatewayFeeBdt: number;
  platformFeeBdt: number;
  totalFeeBdt: number;
  doctorPayoutBdt: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function assertValidFeeRates(rates: FeeRates): void {
  const { gatewayRate, platformRate, minimumChargeBdt } = rates;
  const finite = [gatewayRate, platformRate, minimumChargeBdt].every(Number.isFinite);
  if (!finite) throw new RangeError('Fee rates must be finite numbers');
  if (gatewayRate < 0 || platformRate < 0 || minimumChargeBdt < 0) {
    throw new RangeError('Fee rates and minimum charge cannot be negative');
  }
  if (gatewayRate + platformRate >= 1) {
    throw new RangeError('Combined fee rate must be below 100%');
  }
}

/**
 * Splits one consultation/service amount into gateway fee, platform fee and the
 * provider payout. The fee never exceeds the amount being charged.
 */
export function calculateServiceFee(
  amountBdt: number,
  rates: FeeRates = DEFAULT_FEE_RATES,
): FeeBreakdown {
  assertValidFeeRates(rates);

  const amount = Number.isFinite(amountBdt) ? round2(Math.max(0, amountBdt)) : 0;
  const combinedRate = rates.gatewayRate + rates.platformRate;

  if (amount === 0) {
    return {
      amountBdt: 0,
      combinedRate,
      percentageFeeBdt: 0,
      minimumApplied: false,
      gatewayFeeBdt: 0,
      platformFeeBdt: 0,
      totalFeeBdt: 0,
      doctorPayoutBdt: 0,
    };
  }

  const percentageFeeBdt = round2(amount * combinedRate);
  const minimumApplied = percentageFeeBdt < rates.minimumChargeBdt;
  const totalFeeBdt = round2(
    Math.min(minimumApplied ? rates.minimumChargeBdt : percentageFeeBdt, amount),
  );

  const gatewayFeeBdt =
    combinedRate === 0 ? 0 : round2((totalFeeBdt * rates.gatewayRate) / combinedRate);
  const platformFeeBdt = round2(totalFeeBdt - gatewayFeeBdt);

  return {
    amountBdt: amount,
    combinedRate,
    percentageFeeBdt,
    minimumApplied,
    gatewayFeeBdt,
    platformFeeBdt,
    totalFeeBdt,
    doctorPayoutBdt: round2(amount - totalFeeBdt),
  };
}
