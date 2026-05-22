import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  parseDateOnly,
  round2,
  startOfDayUtc,
  toFinanceRecordJsonDto,
  type FinanceRecordJsonDto,
} from "./finance-mapper";
import type {
  CreateExpenseBody,
  CreateIncomeBody,
  FinanceRangeQuery,
  ListFinanceQuery,
  PatchExpenseBody,
  PatchIncomeBody,
} from "./schemas";

function defaultRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const toDate = to ? parseDateOnly(to) : startOfDayUtc(now);
  const fromDate = from
    ? parseDateOnly(from)
    : new Date(toDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

function previousRange(from: Date, to: Date): { from: Date; to: Date } {
  const spanMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - spanMs);
  return { from: prevFrom, to: prevTo };
}

async function listByType(
  customerProfileId: string,
  type: "EXPENSE" | "INCOME",
  query: ListFinanceQuery,
): Promise<{ records: FinanceRecordJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const { from, to } = defaultRange(query.from, query.to);
  const where: Prisma.FinanceRecordWhereInput = {
    customerId: customerProfileId,
    type,
    recordedDate: { gte: from, lte: to },
    ...(type === "EXPENSE" && query.category ? { category: query.category } : {}),
    ...(type === "INCOME" && query.source ? { source: query.source } : {}),
    ...(query.search
      ? { notes: { contains: query.search, mode: "insensitive" } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.financeRecord.count({ where }),
    prisma.financeRecord.findMany({
      where,
      orderBy: [{ recordedDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    records: rows.map(toFinanceRecordJsonDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function listExpensesForCustomer(
  customerProfileId: string,
  query: ListFinanceQuery,
) {
  return listByType(customerProfileId, "EXPENSE", query);
}

export async function listIncomeForCustomer(
  customerProfileId: string,
  query: ListFinanceQuery,
) {
  return listByType(customerProfileId, "INCOME", query);
}

export async function createExpenseForCustomer(
  customerProfileId: string,
  body: CreateExpenseBody,
): Promise<FinanceRecordJsonDto> {
  const row = await prisma.financeRecord.create({
    data: {
      customerId: customerProfileId,
      type: "EXPENSE",
      amountBdt: new Prisma.Decimal(body.amountBdt.toFixed(2)),
      category: body.category,
      recordedDate: parseDateOnly(body.recordedDate),
      farmRef: body.farmRef?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    },
  });
  return toFinanceRecordJsonDto(row);
}

export async function createIncomeForCustomer(
  customerProfileId: string,
  body: CreateIncomeBody,
): Promise<FinanceRecordJsonDto> {
  const row = await prisma.financeRecord.create({
    data: {
      customerId: customerProfileId,
      type: "INCOME",
      amountBdt: new Prisma.Decimal(body.amountBdt.toFixed(2)),
      source: body.source,
      recordedDate: parseDateOnly(body.recordedDate),
      farmRef: body.farmRef?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    },
  });
  return toFinanceRecordJsonDto(row);
}

export async function getFinanceForCustomer(
  customerProfileId: string,
  id: string,
  type: "EXPENSE" | "INCOME",
): Promise<FinanceRecordJsonDto | null> {
  const row = await prisma.financeRecord.findFirst({
    where: { id, customerId: customerProfileId, type },
  });
  return row ? toFinanceRecordJsonDto(row) : null;
}

export async function patchExpenseForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchExpenseBody,
): Promise<FinanceRecordJsonDto | null> {
  const existing = await prisma.financeRecord.findFirst({
    where: { id, customerId: customerProfileId, type: "EXPENSE" },
  });
  if (!existing) return null;

  const data: Prisma.FinanceRecordUpdateInput = {};
  if (body.amountBdt !== undefined) data.amountBdt = new Prisma.Decimal(body.amountBdt.toFixed(2));
  if (body.category !== undefined) data.category = body.category;
  if (body.recordedDate !== undefined) data.recordedDate = parseDateOnly(body.recordedDate);
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.notes !== undefined) data.notes = body.notes;

  const row = await prisma.financeRecord.update({ where: { id }, data });
  return toFinanceRecordJsonDto(row);
}

export async function patchIncomeForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchIncomeBody,
): Promise<FinanceRecordJsonDto | null> {
  const existing = await prisma.financeRecord.findFirst({
    where: { id, customerId: customerProfileId, type: "INCOME" },
  });
  if (!existing) return null;

  const data: Prisma.FinanceRecordUpdateInput = {};
  if (body.amountBdt !== undefined) data.amountBdt = new Prisma.Decimal(body.amountBdt.toFixed(2));
  if (body.source !== undefined) data.source = body.source;
  if (body.recordedDate !== undefined) data.recordedDate = parseDateOnly(body.recordedDate);
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.notes !== undefined) data.notes = body.notes;

  const row = await prisma.financeRecord.update({ where: { id }, data });
  return toFinanceRecordJsonDto(row);
}

export async function deleteFinanceForCustomer(
  customerProfileId: string,
  id: string,
  type: "EXPENSE" | "INCOME",
): Promise<boolean> {
  const existing = await prisma.financeRecord.findFirst({
    where: { id, customerId: customerProfileId, type },
  });
  if (!existing) return false;
  await prisma.financeRecord.delete({ where: { id } });
  return true;
}

async function sumByType(
  customerProfileId: string,
  type: "EXPENSE" | "INCOME",
  from: Date,
  to: Date,
): Promise<number> {
  const agg = await prisma.financeRecord.aggregate({
    where: {
      customerId: customerProfileId,
      type,
      recordedDate: { gte: from, lte: to },
    },
    _sum: { amountBdt: true },
  });
  return agg._sum.amountBdt ? Number(agg._sum.amountBdt) : 0;
}

export async function profitForCustomer(
  customerProfileId: string,
  query: FinanceRangeQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const prev = previousRange(from, to);

  const [income, expense, prevIncome, prevExpense] = await Promise.all([
    sumByType(customerProfileId, "INCOME", from, to),
    sumByType(customerProfileId, "EXPENSE", from, to),
    sumByType(customerProfileId, "INCOME", prev.from, prev.to),
    sumByType(customerProfileId, "EXPENSE", prev.from, prev.to),
  ]);

  const profit = income - expense;
  const prevProfit = prevIncome - prevExpense;
  const changePct = prevProfit === 0 ? null : round2(((profit - prevProfit) / Math.abs(prevProfit)) * 100);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totalIncomeBdt: round2(income),
    totalExpenseBdt: round2(expense),
    profitBdt: round2(profit),
    previousPeriod: {
      from: prev.from.toISOString().slice(0, 10),
      to: prev.to.toISOString().slice(0, 10),
      totalIncomeBdt: round2(prevIncome),
      totalExpenseBdt: round2(prevExpense),
      profitBdt: round2(prevProfit),
    },
    profitChangePercent: changePct,
  };
}

export async function chartsForCustomer(
  customerProfileId: string,
  query: FinanceRangeQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const rows = await prisma.financeRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: to },
    },
    orderBy: [{ recordedDate: "asc" }],
  });

  const byDay = new Map<string, { date: string; incomeBdt: number; expenseBdt: number; profitBdt: number }>();

  for (const row of rows) {
    const dayKey = row.recordedDate.toISOString().slice(0, 10);
    const bucket = byDay.get(dayKey) ?? { date: dayKey, incomeBdt: 0, expenseBdt: 0, profitBdt: 0 };
    const amount = Number(row.amountBdt);
    if (row.type === "INCOME") bucket.incomeBdt += amount;
    else bucket.expenseBdt += amount;
    bucket.profitBdt = bucket.incomeBdt - bucket.expenseBdt;
    byDay.set(dayKey, bucket);
  }

  const daily = [...byDay.values()].map((d) => ({
    ...d,
    incomeBdt: round2(d.incomeBdt),
    expenseBdt: round2(d.expenseBdt),
    profitBdt: round2(d.profitBdt),
  }));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    incomeTrend: daily.map((d) => ({ date: d.date, amountBdt: d.incomeBdt })),
    expenseTrend: daily.map((d) => ({ date: d.date, amountBdt: d.expenseBdt })),
    profitTrend: daily.map((d) => ({ date: d.date, amountBdt: d.profitBdt })),
  };
}

export async function reportsForCustomer(
  customerProfileId: string,
  query: FinanceRangeQuery,
) {
  const { from, to } = defaultRange(query.from, query.to);
  const rows = await prisma.financeRecord.findMany({
    where: {
      customerId: customerProfileId,
      recordedDate: { gte: from, lte: to },
    },
  });

  const byCategory = new Map<string, { category: string; totalBdt: number; count: number }>();
  const bySource = new Map<string, { source: string; totalBdt: number; count: number }>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of rows) {
    const amount = Number(row.amountBdt);
    if (row.type === "INCOME") {
      totalIncome += amount;
      const key = row.source ?? "OTHER";
      const bucket = bySource.get(key) ?? { source: key, totalBdt: 0, count: 0 };
      bucket.totalBdt += amount;
      bucket.count += 1;
      bySource.set(key, bucket);
    } else {
      totalExpense += amount;
      const key = row.category ?? "OTHER";
      const bucket = byCategory.get(key) ?? { category: key, totalBdt: 0, count: 0 };
      bucket.totalBdt += amount;
      bucket.count += 1;
      byCategory.set(key, bucket);
    }
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totalIncomeBdt: round2(totalIncome),
    totalExpenseBdt: round2(totalExpense),
    profitBdt: round2(totalIncome - totalExpense),
    expenseByCategory: [...byCategory.values()].map((b) => ({
      ...b,
      totalBdt: round2(b.totalBdt),
    })),
    incomeBySource: [...bySource.values()].map((b) => ({
      ...b,
      totalBdt: round2(b.totalBdt),
    })),
    export: {
      csvPath: `/api/mobile/finance/reports/export?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&format=csv`,
      pdfPath: `/api/mobile/finance/reports/export?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&format=pdf`,
      note: "Export endpoints reserved for a future release; aggregates are available now.",
    },
  };
}
