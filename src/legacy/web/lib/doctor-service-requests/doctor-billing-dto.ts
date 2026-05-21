import type { BillingRecord } from "@/generated/prisma/client";
import {
  BillingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@/generated/prisma/client";

import { calculateBillingTotals } from "@/lib/billing-calculation";

import { mapPaymentStatusToBillingStatus } from "./billing-status-map";

export type DoctorBillingDto = {
  id: string;
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  discount: number;
  subtotal: number;
  totalCollected: number;
  commissionBase: number;
  platformCommission: number;
  providerPayout: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  billingStatus: BillingStatus;
  currency: string;
};

function decToNum(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  const n = Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}

export function toDoctorBillingDtoFromTotals(params: {
  id: string;
  totals: ReturnType<typeof calculateBillingTotals>;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  currency: string;
}): DoctorBillingDto {
  const billingStatus = mapPaymentStatusToBillingStatus(params.paymentStatus);
  return {
    id: params.id,
    serviceFee: params.totals.serviceFee,
    travelCost: params.totals.travelCost,
    medicineCost: params.totals.medicineCost,
    discount: params.totals.discount,
    subtotal: params.totals.subtotal,
    totalCollected: params.totals.totalCollected,
    commissionBase: params.totals.commissionBase,
    platformCommission: params.totals.platformCommission,
    providerPayout: params.totals.providerPayout,
    paymentMethod: params.paymentMethod,
    paymentStatus: params.paymentStatus,
    billingStatus,
    currency: params.currency,
  };
}

/** Loads persisted billing row into DTO (recomputes commissionBase from fees using default allocation). */
export function toDoctorBillingDtoFromRecord(
  row: BillingRecord,
  commissionRateForCommissionBase = 0,
): DoctorBillingDto {
  const serviceFee = decToNum(row.serviceFee);
  const travelCost = decToNum(row.travelCost);
  const medicineCost = decToNum(row.medicineCost);
  const discount = decToNum(row.discountAmount);

  const totals = calculateBillingTotals({
    serviceFee,
    travelCost,
    medicineCost,
    discount,
    commissionRate: commissionRateForCommissionBase,
  });

  const pm = row.paymentMethod ?? PaymentMethod.CASH;

  return {
    id: row.id,
    serviceFee,
    travelCost,
    medicineCost,
    discount,
    subtotal: decToNum(row.subtotal) || totals.subtotal,
    totalCollected: decToNum(row.totalCollected),
    commissionBase: totals.commissionBase,
    platformCommission: decToNum(row.platformCommission),
    providerPayout: decToNum(row.providerPayout),
    paymentMethod: pm,
    paymentStatus: row.paymentStatus,
    billingStatus: row.status,
    currency: row.currency,
  };
}
