import type { FarmTreatment, FarmTreatmentStatus } from "@/generated/prisma/client";

export type MedicineItemJson = {
  name: string;
  dosage: string;
  frequency?: string;
  durationDays?: number;
};

export type FarmTreatmentJsonDto = {
  id: string;
  customerId: string;
  animalId: string | null;
  animalName: string | null;
  farmRef: string | null;
  title: string;
  diagnosis: string | null;
  prescription: string | null;
  medicines: MedicineItemJson[];
  startDate: string;
  endDate: string | null;
  status: FarmTreatmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = FarmTreatment & { animal?: { name: string } | null };

export function parseMedicinesJson(value: unknown): MedicineItemJson[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      name: String(item.name ?? ""),
      dosage: String(item.dosage ?? ""),
      frequency: item.frequency != null ? String(item.frequency) : undefined,
      durationDays: typeof item.durationDays === "number" ? item.durationDays : undefined,
    }))
    .filter((m) => m.name.length > 0);
}

export function toFarmTreatmentJsonDto(row: Row): FarmTreatmentJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    animalId: row.animalId,
    animalName: row.animal?.name ?? null,
    farmRef: row.farmRef,
    title: row.title,
    diagnosis: row.diagnosis,
    prescription: row.prescription,
    medicines: parseMedicinesJson(row.medicinesJson),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    status: row.status,
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
