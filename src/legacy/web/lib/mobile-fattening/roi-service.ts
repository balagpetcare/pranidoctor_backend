import { ExpenseCategory, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { round2, startOfDayUtc } from "@/lib/mobile-feeds/feed-mapper";

import {
  toRoiSettingsDto,
  type BatchRoiJsonDto,
  type FatteningBatchRoiSettingsDto,
} from "./roi-mapper";
import type { UpsertBatchRoiBody } from "./roi-schemas";

async function assertBatchOwned(customerId: string, batchId: string) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  return batch;
}

function dateRangeForBatch(batch: { startDate: Date | null }) {
  const to = startOfDayUtc(new Date());
  const from = batch.startDate
    ? startOfDayUtc(batch.startDate)
    : new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function getBatchRoiForCustomer(
  customerId: string,
  batchId: string,
): Promise<BatchRoiJsonDto> {
  const batch = await assertBatchOwned(customerId, batchId);
  const { from, to } = dateRangeForBatch(batch);

  const [roiRow, feedAgg, treatmentRows, purchaseFinanceRows] = await Promise.all([
    prisma.fatteningBatchRoi.findUnique({ where: { batchId } }),
    prisma.feedRecord.aggregate({
      where: {
        customerId,
        fatteningBatchId: batchId,
        recordedDate: { gte: from, lte: to },
      },
      _sum: { costBdt: true, amount: true },
      _count: { id: true },
    }),
    prisma.financeRecord.findMany({
      where: {
        customerId,
        type: "EXPENSE",
        category: ExpenseCategory.MEDICINE,
        fatteningBatchId: batchId,
        recordedDate: { gte: from, lte: to },
      },
      select: { id: true, amountBdt: true },
    }),
    prisma.financeRecord.findMany({
      where: {
        customerId,
        type: "EXPENSE",
        fatteningBatchId: batchId,
        category: {
          notIn: [ExpenseCategory.FEED, ExpenseCategory.MEDICINE],
        },
        recordedDate: { gte: from, lte: to },
      },
      select: { id: true, amountBdt: true },
    }),
  ]);

  const settings = toRoiSettingsDto(
    roiRow && roiRow.customerId === customerId ? roiRow : null,
  );

  const feedAmount = round2(Number(feedAgg._sum.costBdt ?? 0));
  const feedCount = feedAgg._count.id;

  let treatmentAmount = 0;
  for (const row of treatmentRows) {
    treatmentAmount += Number(row.amountBdt);
  }
  treatmentAmount = round2(treatmentAmount);

  let financePurchase = 0;
  for (const row of purchaseFinanceRows) {
    financePurchase += Number(row.amountBdt);
  }
  financePurchase = round2(financePurchase);

  const manualPurchase = settings?.purchaseCostBdt ?? null;
  const purchaseAmount =
    manualPurchase != null ? manualPurchase : financePurchase;

  const projectedSaleAmount = settings?.projectedSaleBdt ?? 0;
  const totalCost = round2(purchaseAmount + feedAmount + treatmentAmount);
  const profit = round2(projectedSaleAmount - totalCost);
  const margin =
    projectedSaleAmount > 0
      ? round2((profit / projectedSaleAmount) * 100)
      : null;

  return {
    batchId,
    purchase: {
      amountBdt: purchaseAmount,
      manualAmountBdt: manualPurchase,
      financeAmountBdt: financePurchase,
    },
    feed: { amountBdt: feedAmount, recordCount: feedCount },
    treatment: {
      amountBdt: treatmentAmount,
      recordCount: treatmentRows.length,
    },
    totalCostBdt: totalCost,
    projectedSale: { amountBdt: projectedSaleAmount },
    profitBdt: profit,
    profitMarginPct: margin,
    settings,
  };
}

export async function upsertBatchRoiForCustomer(
  customerId: string,
  batchId: string,
  body: UpsertBatchRoiBody,
): Promise<FatteningBatchRoiSettingsDto> {
  await assertBatchOwned(customerId, batchId);

  const data: Prisma.FatteningBatchRoiUpsertArgs["create"] = {
    customerId,
    batchId,
    purchaseCostBdt:
      body.purchaseCostBdt != null
        ? new Prisma.Decimal(body.purchaseCostBdt.toFixed(2))
        : null,
    projectedSaleBdt:
      body.projectedSaleBdt != null
        ? new Prisma.Decimal(body.projectedSaleBdt.toFixed(2))
        : null,
    notes: body.notes?.trim() || null,
  };

  const row = await prisma.fatteningBatchRoi.upsert({
    where: { batchId },
    create: data,
    update: {
      ...(body.purchaseCostBdt !== undefined
        ? {
            purchaseCostBdt:
              body.purchaseCostBdt == null
                ? null
                : new Prisma.Decimal(body.purchaseCostBdt.toFixed(2)),
          }
        : {}),
      ...(body.projectedSaleBdt !== undefined
        ? {
            projectedSaleBdt:
              body.projectedSaleBdt == null
                ? null
                : new Prisma.Decimal(body.projectedSaleBdt.toFixed(2)),
          }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
    },
  });

  return toRoiSettingsDto(row)!;
}
