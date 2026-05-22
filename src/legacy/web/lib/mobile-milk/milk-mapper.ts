import type { MilkRecord, MilkSession } from "@/generated/prisma/client";

export type MilkRecordJsonDto = {
  id: string;
  customerId: string;
  animalId: string;
  animalName: string;
  farmRef: string | null;
  recordedDate: string;
  session: MilkSession;
  quantityLiters: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toMilkRecordJsonDto(
  row: MilkRecord & { animal: { name: string } },
): MilkRecordJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    animalId: row.animalId,
    animalName: row.animal.name,
    farmRef: row.farmRef,
    recordedDate: row.recordedDate.toISOString().slice(0, 10),
    session: row.session,
    quantityLiters: row.quantityLiters.toString(),
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

export function endOfDayUtc(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}
