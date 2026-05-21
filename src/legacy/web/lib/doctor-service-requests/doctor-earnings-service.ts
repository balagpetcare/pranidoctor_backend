import { endOfMonth, startOfMonth } from "date-fns";

import { PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function decToNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export type DoctorEarningsSummaryDto = {
  totalCollected: number;
  totalPlatformCommission: number;
  totalProviderPayout: number;
  paidCount: number;
  unpaidCount: number;
  currentMonthEarnings: number;
};

export async function getDoctorEarningsSummary(
  doctorProfileId: string,
): Promise<DoctorEarningsSummaryDto> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    aggregates,
    paidCount,
    unpaidCount,
    monthAgg,
  ] = await Promise.all([
    prisma.billingRecord.aggregate({
      where: { doctorId: doctorProfileId },
      _sum: {
        totalCollected: true,
        platformCommission: true,
        providerPayout: true,
      },
    }),
    prisma.billingRecord.count({
      where: {
        doctorId: doctorProfileId,
        paymentStatus: PaymentStatus.PAID,
      },
    }),
    prisma.billingRecord.count({
      where: {
        doctorId: doctorProfileId,
        paymentStatus: {
          in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
        },
      },
    }),
    prisma.billingRecord.aggregate({
      where: {
        doctorId: doctorProfileId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { providerPayout: true },
    }),
  ]);

  return {
    totalCollected: decToNumber(aggregates._sum.totalCollected),
    totalPlatformCommission: decToNumber(aggregates._sum.platformCommission),
    totalProviderPayout: decToNumber(aggregates._sum.providerPayout),
    paidCount,
    unpaidCount,
    currentMonthEarnings: decToNumber(monthAgg._sum.providerPayout),
  };
}
