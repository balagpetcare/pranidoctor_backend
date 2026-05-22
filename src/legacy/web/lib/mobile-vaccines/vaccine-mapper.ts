import type { VaccineRecord, VaccineStatus } from "@/generated/prisma/client";

export type VaccineRecordJsonDto = {
  id: string;
  customerId: string;
  animalId: string | null;
  animalName: string | null;
  farmRef: string | null;
  vaccineName: string;
  vaccineType: string | null;
  scheduledDate: string;
  administeredDate: string | null;
  nextDueDate: string | null;
  status: VaccineStatus;
  batchNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = VaccineRecord & { animal?: { name: string } | null };

export function toVaccineRecordJsonDto(row: Row): VaccineRecordJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    animalId: row.animalId,
    animalName: row.animal?.name ?? null,
    farmRef: row.farmRef,
    vaccineName: row.vaccineName,
    vaccineType: row.vaccineType,
    scheduledDate: row.scheduledDate.toISOString().slice(0, 10),
    administeredDate: row.administeredDate?.toISOString().slice(0, 10) ?? null,
    nextDueDate: row.nextDueDate?.toISOString().slice(0, 10) ?? null,
    status: row.status,
    batchNumber: row.batchNumber,
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

export function computeVaccineStatus(
  scheduledDate: Date,
  administeredDate: Date | null,
  nextDueDate: Date | null,
): VaccineStatus {
  if (administeredDate) return "COMPLETED";
  const today = startOfDayUtc(new Date());
  if (scheduledDate.getTime() < today.getTime()) return "OVERDUE";
  const diffDays = (scheduledDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays <= 7) return "DUE";
  return "SCHEDULED";
}
