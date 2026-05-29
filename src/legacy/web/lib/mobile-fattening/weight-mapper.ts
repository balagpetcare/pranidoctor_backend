import type { AnimalProfile, WeightRecord, WeightRecordMethod } from "@/generated/prisma/client";

export type WeightRecordJsonDto = {
  id: string;
  animalId: string;
  batchId: string;
  weightKg: string;
  recordedAt: string;
  recordedOn: string;
  method: WeightRecordMethod;
  note: string | null;
  photoUrl: string | null;
  animalName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type WeightWithAnimal = WeightRecord & { animal?: Pick<AnimalProfile, "name"> };

export function toWeightRecordJsonDto(row: WeightWithAnimal): WeightRecordJsonDto {
  return {
    id: row.id,
    animalId: row.animalId,
    batchId: row.batchId,
    weightKg: row.weightKg.toString(),
    recordedAt: row.recordedAt.toISOString(),
    recordedOn: row.recordedOn.toISOString().slice(0, 10),
    method: row.method,
    note: row.note,
    photoUrl: row.photoUrl,
    animalName: row.animal?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function computeGainKg(
  initial: string | null,
  current: string | null,
): string | null {
  if (initial == null || current == null) return null;
  const a = Number(initial);
  const b = Number(current);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a).toFixed(3).replace(/\.?0+$/, "") || "0";
}
