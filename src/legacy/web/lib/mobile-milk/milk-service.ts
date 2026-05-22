import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  endOfDayUtc,
  parseDateOnly,
  startOfDayUtc,
  toMilkRecordJsonDto,
  type MilkRecordJsonDto,
} from "./milk-mapper";
import type {
  CreateMilkBody,
  ListMilkQuery,
  MilkChartsQuery,
  MilkSummaryQuery,
  PatchMilkBody,
} from "./schemas";

const milkInclude = { animal: { select: { name: true } } } as const;

function defaultRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const toDate = to ? parseDateOnly(to) : startOfDayUtc(now);
  const fromDate = from
    ? parseDateOnly(from)
    : new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

export async function listMilkForCustomer(
  customerProfileId: string,
  query: ListMilkQuery,
): Promise<{ records: MilkRecordJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const { from, to } = defaultRange(query.from, query.to);
  const where: Prisma.MilkRecordWhereInput = {
    customerId: customerProfileId,
    recordedDate: { gte: from, lte: to },
    ...(query.animalId ? { animalId: query.animalId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.milkRecord.count({ where }),
    prisma.milkRecord.findMany({
      where,
      include: milkInclude,
      orderBy: [{ recordedDate: "desc" }, { session: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    records: rows.map(toMilkRecordJsonDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function createMilkForCustomer(
  customerProfileId: string,
  body: CreateMilkBody,
): Promise<MilkRecordJsonDto> {
  const animal = await prisma.animalProfile.findFirst({
    where: { id: body.animalId, customerId: customerProfileId, active: true },
  });
  if (!animal) {
    throw new Error("ANIMAL_NOT_FOUND");
  }

  const row = await prisma.milkRecord.create({
    data: {
      customerId: customerProfileId,
      animalId: body.animalId,
      farmRef: body.farmRef?.trim() || undefined,
      recordedDate: parseDateOnly(body.recordedDate),
      session: body.session,
      quantityLiters: new Prisma.Decimal(body.quantityLiters.toFixed(3)),
      notes: body.notes?.trim() || undefined,
    },
    include: milkInclude,
  });
  return toMilkRecordJsonDto(row);
}

export async function getMilkForCustomer(
  customerProfileId: string,
  id: string,
): Promise<MilkRecordJsonDto | null> {
  const row = await prisma.milkRecord.findFirst({
    where: { id, customerId: customerProfileId },
    include: milkInclude,
  });
  return row ? toMilkRecordJsonDto(row) : null;
}

export async function patchMilkForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchMilkBody,
): Promise<MilkRecordJsonDto | null> {
  const existing = await prisma.milkRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return null;

  if (body.animalId !== undefined) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const data: Prisma.MilkRecordUpdateInput = {};
  if (body.animalId !== undefined) data.animal = { connect: { id: body.animalId } };
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.recordedDate !== undefined) data.recordedDate = parseDateOnly(body.recordedDate);
  if (body.session !== undefined) data.session = body.session;
  if (body.quantityLiters !== undefined) {
    data.quantityLiters = new Prisma.Decimal(body.quantityLiters.toFixed(3));
  }
  if (body.notes !== undefined) data.notes = body.notes;

  if (Object.keys(data).length === 0) {
    const row = await prisma.milkRecord.findFirst({
      where: { id },
      include: milkInclude,
    });
    return row ? toMilkRecordJsonDto(row) : null;
  }

  const row = await prisma.milkRecord.update({
    where: { id },
    data,
    include: milkInclude,
  });
  return toMilkRecordJsonDto(row);
}

export async function deleteMilkForCustomer(
  customerProfileId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.milkRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return false;
  await prisma.milkRecord.delete({ where: { id } });
  return true;
}

type SummaryBucket = {
  animalId: string;
  animalName: string;
  totalLiters: number;
  morningLiters: number;
  eveningLiters: number;
};

export async function summaryMilkForCustomer(
  customerProfileId: string,
  query: MilkSummaryQuery,
) {
  const { from, to } = query.date
    ? { from: parseDateOnly(query.date), to: parseDateOnly(query.date) }
    : defaultRange(query.from, query.to);

  const rows = await prisma.milkRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: to },
    },
    include: milkInclude,
    orderBy: [{ recordedDate: "asc" }],
  });

  let totalLiters = 0;
  let morningLiters = 0;
  let eveningLiters = 0;
  const byAnimalMap = new Map<string, SummaryBucket>();
  const byDayMap = new Map<string, { date: string; totalLiters: number; morningLiters: number; eveningLiters: number }>();

  for (const row of rows) {
    const qty = Number(row.quantityLiters);
    totalLiters += qty;
    if (row.session === "MORNING") morningLiters += qty;
    else eveningLiters += qty;

    const animalBucket = byAnimalMap.get(row.animalId) ?? {
      animalId: row.animalId,
      animalName: row.animal.name,
      totalLiters: 0,
      morningLiters: 0,
      eveningLiters: 0,
    };
    animalBucket.totalLiters += qty;
    if (row.session === "MORNING") animalBucket.morningLiters += qty;
    else animalBucket.eveningLiters += qty;
    byAnimalMap.set(row.animalId, animalBucket);

    const dayKey = row.recordedDate.toISOString().slice(0, 10);
    const dayBucket = byDayMap.get(dayKey) ?? {
      date: dayKey,
      totalLiters: 0,
      morningLiters: 0,
      eveningLiters: 0,
    };
    dayBucket.totalLiters += qty;
    if (row.session === "MORNING") dayBucket.morningLiters += qty;
    else dayBucket.eveningLiters += qty;
    byDayMap.set(dayKey, dayBucket);
  }

  return {
    date: query.date ?? null,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totalLiters: round3(totalLiters),
    morningLiters: round3(morningLiters),
    eveningLiters: round3(eveningLiters),
    byAnimal: [...byAnimalMap.values()].map((b) => ({
      ...b,
      totalLiters: round3(b.totalLiters),
      morningLiters: round3(b.morningLiters),
      eveningLiters: round3(b.eveningLiters),
    })),
    byDay: [...byDayMap.values()].map((b) => ({
      ...b,
      totalLiters: round3(b.totalLiters),
      morningLiters: round3(b.morningLiters),
      eveningLiters: round3(b.eveningLiters),
    })),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
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

export async function chartsMilkForCustomer(
  customerProfileId: string,
  query: MilkChartsQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const rows = await prisma.milkRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: endOfDayUtc(to) },
    },
    orderBy: [{ recordedDate: "asc" }],
  });

  const dailyMap = new Map<string, { date: string; totalLiters: number; morningLiters: number; eveningLiters: number }>();
  const weeklyMap = new Map<string, { weekStart: string; totalLiters: number }>();
  const monthlyMap = new Map<string, { month: string; totalLiters: number }>();
  let sessionMorning = 0;
  let sessionEvening = 0;

  for (const row of rows) {
    const qty = Number(row.quantityLiters);
    if (row.session === "MORNING") sessionMorning += qty;
    else sessionEvening += qty;

    const dayKey = row.recordedDate.toISOString().slice(0, 10);
    const day = dailyMap.get(dayKey) ?? { date: dayKey, totalLiters: 0, morningLiters: 0, eveningLiters: 0 };
    day.totalLiters += qty;
    if (row.session === "MORNING") day.morningLiters += qty;
    else day.eveningLiters += qty;
    dailyMap.set(dayKey, day);

    const wk = weekStartKey(row.recordedDate);
    const week = weeklyMap.get(wk) ?? { weekStart: wk, totalLiters: 0 };
    week.totalLiters += qty;
    weeklyMap.set(wk, week);

    const mk = monthKey(row.recordedDate);
    const month = monthlyMap.get(mk) ?? { month: mk, totalLiters: 0 };
    month.totalLiters += qty;
    monthlyMap.set(mk, month);
  }

  const mapDaily = (b: { date: string; totalLiters: number; morningLiters: number; eveningLiters: number }) => ({
    ...b,
    totalLiters: round3(b.totalLiters),
    morningLiters: round3(b.morningLiters),
    eveningLiters: round3(b.eveningLiters),
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    period: query.period,
    dailyProduction: [...dailyMap.values()].map(mapDaily),
    weeklyTrend: [...weeklyMap.values()]
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((b) => ({ ...b, totalLiters: round3(b.totalLiters) })),
    monthlyTrend: [...monthlyMap.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((b) => ({ ...b, totalLiters: round3(b.totalLiters) })),
    sessionSplit: {
      morning: round3(sessionMorning),
      evening: round3(sessionEvening),
    },
  };
}
