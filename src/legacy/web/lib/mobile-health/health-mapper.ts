import type { HealthEvent, HealthEventType } from "@/generated/prisma/client";

export type HealthEventJsonDto = {
  id: string;
  customerId: string;
  animalId: string | null;
  animalName: string | null;
  farmRef: string | null;
  eventType: HealthEventType;
  title: string;
  symptoms: string | null;
  diagnosis: string | null;
  diseaseName: string | null;
  treatmentRefId: string | null;
  vaccineRefId: string | null;
  notes: string | null;
  recordedDate: string;
  createdAt: string;
  updatedAt: string;
};

type Row = HealthEvent & { animal?: { name: string } | null };

export function toHealthEventJsonDto(row: Row): HealthEventJsonDto {
  return {
    id: row.id,
    customerId: row.customerId,
    animalId: row.animalId,
    animalName: row.animal?.name ?? null,
    farmRef: row.farmRef,
    eventType: row.eventType,
    title: row.title,
    symptoms: row.symptoms,
    diagnosis: row.diagnosis,
    diseaseName: row.diseaseName,
    treatmentRefId: row.treatmentRefId,
    vaccineRefId: row.vaccineRefId,
    notes: row.notes,
    recordedDate: row.recordedDate.toISOString().slice(0, 10),
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
