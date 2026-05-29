import type { FeedRecord, FeedType, FeedUnit } from "@/generated/prisma/client";

export type FeedRecordJsonDto = {
  id: string;
  customerId: string;
  farmRef: string | null;
  animalId: string | null;
  animalName: string | null;
  batchId: string | null;
  batchName: string | null;
  fatteningBatchId: string | null;
  feedType: FeedType;
  amount: string;
  unit: FeedUnit;
  costBdt: string | null;
  recordedDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toFeedRecordJsonDto(
  row: FeedRecord & { animal?: { name: string } | null },
): FeedRecordJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    animalId: row.animalId,
    animalName: row.animal?.name ?? null,
    batchId: row.batchId,
    batchName: row.batchName,
    fatteningBatchId: row.fatteningBatchId,
    feedType: row.feedType,
    amount: row.amount.toString(),
    unit: row.unit,
    costBdt: row.costBdt?.toString() ?? null,
    recordedDate: row.recordedDate.toISOString().slice(0, 10),
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export { round2, round3 };
