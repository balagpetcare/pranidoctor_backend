import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { parseDateOnly, round2, round3, startOfDayUtc } from "@/lib/mobile-feeds/feed-mapper";

import { toBatchFeedPlanJsonDto, type BatchFeedPlanJsonDto } from "./feed-plan-mapper";
import type { UpsertBatchFeedPlanBody } from "./feed-plan-schemas";

async function assertBatchOwned(customerId: string, batchId: string) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  return batch;
}

export async function getBatchFeedPlanForCustomer(
  customerId: string,
  batchId: string,
): Promise<BatchFeedPlanJsonDto | null> {
  await assertBatchOwned(customerId, batchId);
  const row = await prisma.batchFeedPlan.findUnique({
    where: { batchId },
  });
  if (!row || row.customerId !== customerId) return null;
  return toBatchFeedPlanJsonDto(row);
}

export async function upsertBatchFeedPlanForCustomer(
  customerId: string,
  batchId: string,
  body: UpsertBatchFeedPlanBody,
): Promise<BatchFeedPlanJsonDto> {
  await assertBatchOwned(customerId, batchId);

  const row = await prisma.batchFeedPlan.upsert({
    where: { batchId },
    create: {
      customerId,
      batchId,
      mode: body.mode,
      dailyAmountKg:
        body.dailyAmountKg !== undefined
          ? new Prisma.Decimal(body.dailyAmountKg.toFixed(3))
          : undefined,
      dailyCostBdt:
        body.dailyCostBdt !== undefined
          ? new Prisma.Decimal(body.dailyCostBdt.toFixed(2))
          : undefined,
      feedType: body.feedType,
      unit: body.unit ?? "KG",
      notes: body.notes?.trim() || undefined,
    },
    update: {
      mode: body.mode,
      dailyAmountKg:
        body.dailyAmountKg !== undefined
          ? new Prisma.Decimal(body.dailyAmountKg.toFixed(3))
          : null,
      dailyCostBdt:
        body.dailyCostBdt !== undefined
          ? new Prisma.Decimal(body.dailyCostBdt.toFixed(2))
          : null,
      feedType: body.feedType ?? null,
      unit: body.unit ?? "KG",
      notes: body.notes?.trim() || null,
    },
  });

  return toBatchFeedPlanJsonDto(row);
}

export type BatchFeedDashboardDto = {
  batchId: string;
  plan: BatchFeedPlanJsonDto | null;
  feedCost: {
    totalCostBdt: number;
    totalAmount: number;
    todayCostBdt: number;
    todayAmount: number;
    avgDailyCostBdt: number;
    avgDailyAmount: number;
  };
  dailyFeed: {
    plannedAmountKg: number | null;
    plannedCostBdt: number | null;
    todayAmountKg: number;
    todayCostBdt: number;
    mode: string | null;
  };
  daily: Array<{ date: string; costBdt: number; amount: number }>;
};

export async function getBatchFeedDashboardForCustomer(
  customerId: string,
  batchId: string,
): Promise<BatchFeedDashboardDto> {
  const batch = await assertBatchOwned(customerId, batchId);

  const planRow = await prisma.batchFeedPlan.findUnique({ where: { batchId } });
  const plan =
    planRow && planRow.customerId === customerId
      ? toBatchFeedPlanJsonDto(planRow)
      : null;

  const now = new Date();
  const to = startOfDayUtc(now);
  const from = batch.startDate
    ? startOfDayUtc(batch.startDate)
    : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

  const rows = await prisma.feedRecord.findMany({
    where: {
      customerId,
      fatteningBatchId: batchId,
      recordedDate: { gte: from, lte: to },
    },
    orderBy: [{ recordedDate: "asc" }],
  });

  const todayKey = to.toISOString().slice(0, 10);
  let totalCost = 0;
  let totalAmount = 0;
  let todayCost = 0;
  let todayAmount = 0;
  const byDay = new Map<string, { date: string; costBdt: number; amount: number }>();

  for (const row of rows) {
    const cost = row.costBdt ? Number(row.costBdt) : 0;
    const amount = Number(row.amount);
    totalCost += cost;
    totalAmount += amount;

    const dayKey = row.recordedDate.toISOString().slice(0, 10);
    const day = byDay.get(dayKey) ?? { date: dayKey, costBdt: 0, amount: 0 };
    day.costBdt += cost;
    day.amount += amount;
    byDay.set(dayKey, day);

    if (dayKey === todayKey) {
      todayCost += cost;
      todayAmount += amount;
    }
  }

  const dayCount = Math.max(1, byDay.size);
  const plannedAmount =
    plan?.dailyAmountKg != null ? Number(plan.dailyAmountKg) : null;
  const plannedCost =
    plan?.dailyCostBdt != null ? Number(plan.dailyCostBdt) : null;

  return {
    batchId,
    plan,
    feedCost: {
      totalCostBdt: round2(totalCost),
      totalAmount: round3(totalAmount),
      todayCostBdt: round2(todayCost),
      todayAmount: round3(todayAmount),
      avgDailyCostBdt: round2(totalCost / dayCount),
      avgDailyAmount: round3(totalAmount / dayCount),
    },
    dailyFeed: {
      plannedAmountKg: plannedAmount,
      plannedCostBdt: plannedCost,
      todayAmountKg: round3(todayAmount),
      todayCostBdt: round2(todayCost),
      mode: plan?.mode ?? null,
    },
    daily: [...byDay.values()].map((d) => ({
      date: d.date,
      costBdt: round2(d.costBdt),
      amount: round3(d.amount),
    })),
  };
}
