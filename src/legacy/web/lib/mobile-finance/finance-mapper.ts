import type {
  ExpenseCategory,
  FinanceRecord,
  FinanceType,
  IncomeSource,
} from "@/generated/prisma/client";

export type FinanceRecordJsonDto = {
  id: string;
  customerId: string;
  type: FinanceType;
  amountBdt: string;
  recordedDate: string;
  category: ExpenseCategory | null;
  source: IncomeSource | null;
  farmRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toFinanceRecordJsonDto(row: FinanceRecord): FinanceRecordJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type,
    amountBdt: row.amountBdt.toString(),
    recordedDate: row.recordedDate.toISOString().slice(0, 10),
    category: row.category,
    source: row.source,
    farmRef: row.farmRef,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseDateOnly(value: string): Date {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfDayUtc(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
