import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  parseDateOnly,
  round2,
  round3,
  startOfDayUtc,
  toFeedRecordJsonDto,
  type FeedRecordJsonDto,
} from "./feed-mapper";
import { consumeInventoryForFeedRecord } from "./adapters/inventory-feed.adapter.js";
import type {
  CreateFeedBody,
  FeedAnalyticsQuery,
  FeedCostQuery,
  ListFeedsQuery,
  PatchFeedBody,
} from "./schemas";

const feedInclude = { animal: { select: { name: true } } } as const;

function defaultRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const toDate = to ? parseDateOnly(to) : startOfDayUtc(now);
  const fromDate = from
    ? parseDateOnly(from)
    : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

function weekStartKey(d: Date): string {
  const copy = startOfDayUtc(d);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export async function listFeedsForCustomer(
  customerProfileId: string,
  query: ListFeedsQuery,
): Promise<{ records: FeedRecordJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const { from, to } = defaultRange(query.from, query.to);
  const where: Prisma.FeedRecordWhereInput = {
    customerId: customerProfileId,
    recordedDate: { gte: from, lte: to },
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.batchId ? { batchId: query.batchId } : {}),
    ...(query.fatteningBatchId
      ? { fatteningBatchId: query.fatteningBatchId }
      : {}),
    ...(query.feedType ? { feedType: query.feedType } : {}),
    ...(query.search
      ? {
          OR: [
            { notes: { contains: query.search, mode: "insensitive" } },
            { batchName: { contains: query.search, mode: "insensitive" } },
            { animal: { name: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.feedRecord.count({ where }),
    prisma.feedRecord.findMany({
      where,
      include: feedInclude,
      orderBy: [{ recordedDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    records: rows.map(toFeedRecordJsonDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

async function resolveFatteningBatchFeed(
  customerProfileId: string,
  body: { fatteningBatchId?: string; animalId?: string; batchId?: string; batchName?: string },
): Promise<{ fatteningBatchId?: string; batchId?: string; batchName?: string }> {
  if (!body.fatteningBatchId) {
    return {
      batchId: body.batchId?.trim() || undefined,
      batchName: body.batchName?.trim() || undefined,
    };
  }

  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: body.fatteningBatchId, customerId: customerProfileId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  if (body.animalId) {
    const membership = await prisma.fatteningBatchAnimal.findFirst({
      where: {
        batchId: batch.id,
        animalId: body.animalId,
        removedAt: null,
      },
    });
    if (!membership) throw new Error("ANIMAL_NOT_IN_BATCH");
  }

  return {
    fatteningBatchId: batch.id,
    batchId: batch.id,
    batchName: batch.name,
  };
}

export async function createFeedForCustomer(
  customerProfileId: string,
  body: CreateFeedBody,
): Promise<FeedRecordJsonDto> {
  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const batchFields = await resolveFatteningBatchFeed(customerProfileId, body);

  if (body.deductStock && body.inventoryItemId) {
    const farmRef = body.farmRef?.trim();
    if (!farmRef) throw new Error("FARM_REF_REQUIRED");

    const feed = await prisma.feedRecord.create({
      data: {
        customerId: customerProfileId,
        farmRef,
        animalId: body.animalId || undefined,
        batchId: batchFields.batchId,
        batchName: batchFields.batchName,
        fatteningBatchId: batchFields.fatteningBatchId,
        feedType: body.feedType,
        amount: new Prisma.Decimal(body.amount.toFixed(3)),
        unit: body.unit,
        costBdt:
          body.costBdt !== undefined
            ? new Prisma.Decimal(body.costBdt.toFixed(2))
            : undefined,
        recordedDate: parseDateOnly(body.recordedDate),
        notes: body.notes?.trim() || undefined,
        inventoryItemId: body.inventoryItemId,
        deductStock: true,
      },
      include: feedInclude,
    });

    try {
      const stock = await consumeInventoryForFeedRecord({
        customerId: customerProfileId,
        farmRef,
        inventoryItemId: body.inventoryItemId,
        quantity: body.amount,
        feedRecordId: feed.id,
      });

      const row = await prisma.feedRecord.update({
        where: { id: feed.id },
        data: { inventoryTransactionId: stock.transactionId },
        include: feedInclude,
      });
      return toFeedRecordJsonDto(row);
    } catch (e) {
      await prisma.feedRecord.delete({ where: { id: feed.id } }).catch(() => undefined);
      throw e;
    }
  }

  const row = await prisma.feedRecord.create({
    data: {
      customerId: customerProfileId,
      farmRef: body.farmRef?.trim() || undefined,
      animalId: body.animalId || undefined,
      batchId: batchFields.batchId,
      batchName: batchFields.batchName,
      fatteningBatchId: batchFields.fatteningBatchId,
      feedType: body.feedType,
      amount: new Prisma.Decimal(body.amount.toFixed(3)),
      unit: body.unit,
      costBdt:
        body.costBdt !== undefined
          ? new Prisma.Decimal(body.costBdt.toFixed(2))
          : undefined,
      recordedDate: parseDateOnly(body.recordedDate),
      notes: body.notes?.trim() || undefined,
      inventoryItemId: body.inventoryItemId,
      deductStock: body.deductStock ?? false,
    },
    include: feedInclude,
  });
  return toFeedRecordJsonDto(row);
}

export async function getFeedForCustomer(
  customerProfileId: string,
  id: string,
): Promise<FeedRecordJsonDto | null> {
  const row = await prisma.feedRecord.findFirst({
    where: { id, customerId: customerProfileId },
    include: feedInclude,
  });
  return row ? toFeedRecordJsonDto(row) : null;
}

export async function patchFeedForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchFeedBody,
): Promise<FeedRecordJsonDto | null> {
  const existing = await prisma.feedRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return null;

  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const data: Prisma.FeedRecordUpdateInput = {};
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.animalId !== undefined) {
    data.animal = body.animalId ? { connect: { id: body.animalId } } : { disconnect: true };
  }
  if (body.batchId !== undefined) data.batchId = body.batchId;
  if (body.batchName !== undefined) data.batchName = body.batchName;
  if (body.fatteningBatchId !== undefined) {
    if (body.fatteningBatchId === null) {
      data.fatteningBatch = { disconnect: true };
    } else {
      const batchFields = await resolveFatteningBatchFeed(customerProfileId, {
        fatteningBatchId: body.fatteningBatchId,
        animalId: body.animalId ?? existing.animalId ?? undefined,
      });
      data.fatteningBatch = { connect: { id: batchFields.fatteningBatchId! } };
      data.batchId = batchFields.batchId;
      data.batchName = batchFields.batchName;
    }
  }
  if (body.feedType !== undefined) data.feedType = body.feedType;
  if (body.amount !== undefined) data.amount = new Prisma.Decimal(body.amount.toFixed(3));
  if (body.unit !== undefined) data.unit = body.unit;
  if (body.costBdt !== undefined) {
    data.costBdt =
      body.costBdt === null ? null : new Prisma.Decimal(body.costBdt.toFixed(2));
  }
  if (body.recordedDate !== undefined) data.recordedDate = parseDateOnly(body.recordedDate);
  if (body.notes !== undefined) data.notes = body.notes;

  const row = await prisma.feedRecord.update({
    where: { id },
    data,
    include: feedInclude,
  });
  return toFeedRecordJsonDto(row);
}

export async function deleteFeedForCustomer(
  customerProfileId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.feedRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return false;
  await prisma.feedRecord.delete({ where: { id } });
  return true;
}

export async function costFeedsForCustomer(
  customerProfileId: string,
  query: FeedCostQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const rows = await prisma.feedRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: to },
    },
    include: feedInclude,
    orderBy: [{ recordedDate: "asc" }],
  });

  let totalCost = 0;
  let totalAmount = 0;
  const byDay = new Map<string, { date: string; costBdt: number; amount: number }>();
  const byWeek = new Map<string, { weekStart: string; costBdt: number; amount: number }>();
  const byMonth = new Map<string, { month: string; costBdt: number; amount: number }>();
  const byAnimal = new Map<
    string,
    { animalId: string; animalName: string; costBdt: number; amount: number }
  >();

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

    const wk = weekStartKey(row.recordedDate);
    const week = byWeek.get(wk) ?? { weekStart: wk, costBdt: 0, amount: 0 };
    week.costBdt += cost;
    week.amount += amount;
    byWeek.set(wk, week);

    const mk = monthKey(row.recordedDate);
    const month = byMonth.get(mk) ?? { month: mk, costBdt: 0, amount: 0 };
    month.costBdt += cost;
    month.amount += amount;
    byMonth.set(mk, month);

    if (row.animalId) {
      const key = row.animalId;
      const animal = byAnimal.get(key) ?? {
        animalId: row.animalId,
        animalName: row.animal?.name ?? row.animalId,
        costBdt: 0,
        amount: 0,
      };
      animal.costBdt += cost;
      animal.amount += amount;
      byAnimal.set(key, animal);
    }
  }

  const mapCost = <T extends { costBdt: number; amount: number }>(b: T) => ({
    ...b,
    costBdt: round2(b.costBdt),
    amount: round3(b.amount),
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totalCostBdt: round2(totalCost),
    totalAmount: round3(totalAmount),
    daily: [...byDay.values()].map(mapCost),
    weekly: [...byWeek.values()].map(mapCost),
    monthly: [...byMonth.values()].map(mapCost),
    byAnimal: [...byAnimal.values()].map(mapCost),
  };
}

export async function analyticsFeedsForCustomer(
  customerProfileId: string,
  query: FeedAnalyticsQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const rows = await prisma.feedRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: to },
    },
    orderBy: [{ recordedDate: "asc" }],
  });

  const byType = new Map<string, { feedType: string; costBdt: number; amount: number; count: number }>();
  const trend = new Map<string, { date: string; amount: number; costBdt: number }>();
  let totalCost = 0;
  let totalAmount = 0;
  let recordsWithCost = 0;

  for (const row of rows) {
    const cost = row.costBdt ? Number(row.costBdt) : 0;
    const amount = Number(row.amount);
    totalCost += cost;
    totalAmount += amount;
    if (cost > 0) recordsWithCost += 1;

    const typeBucket = byType.get(row.feedType) ?? {
      feedType: row.feedType,
      costBdt: 0,
      amount: 0,
      count: 0,
    };
    typeBucket.costBdt += cost;
    typeBucket.amount += amount;
    typeBucket.count += 1;
    byType.set(row.feedType, typeBucket);

    const dayKey = row.recordedDate.toISOString().slice(0, 10);
    const day = trend.get(dayKey) ?? { date: dayKey, amount: 0, costBdt: 0 };
    day.amount += amount;
    day.costBdt += cost;
    trend.set(dayKey, day);
  }

  const animalCount = await prisma.animalProfile.count({
    where: { customerId: customerProfileId, active: true },
  });

  const costPerKg = totalAmount > 0 ? totalCost / totalAmount : 0;
  const costPerAnimal = animalCount > 0 ? totalCost / animalCount : 0;
  const avgCostPerRecord = recordsWithCost > 0 ? totalCost / recordsWithCost : 0;

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    costBreakdown: [...byType.values()].map((b) => ({
      ...b,
      costBdt: round2(b.costBdt),
      amount: round3(b.amount),
    })),
    consumptionTrend: [...trend.values()].map((b) => ({
      ...b,
      amount: round3(b.amount),
      costBdt: round2(b.costBdt),
    })),
    efficiency: {
      totalCostBdt: round2(totalCost),
      totalAmount: round3(totalAmount),
      costPerKg: round2(costPerKg),
      costPerAnimal: round2(costPerAnimal),
      avgCostPerRecord: round2(avgCostPerRecord),
      activeAnimals: animalCount,
    },
  };
}
