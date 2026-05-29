import type {
  AnimalProfile,
  FatteningBatch,
  FatteningBatchAnimal,
  FatteningBatchGoalType,
  FatteningBatchStatus,
} from "@/generated/prisma/client";

import { toAnimalJsonDto } from "@/lib/mobile-animals/animal-mapper";

export function parseDateOnly(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("INVALID_DATE");
  }
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function formatDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export type FatteningBatchJsonDto = {
  id: string;
  farmId: string;
  name: string;
  goalType: FatteningBatchGoalType;
  goal: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: FatteningBatchStatus;
  animalCount: number;
  createdAt: string;
  updatedAt: string;
};

type BatchWithCount = FatteningBatch & {
  _count: { animals: number };
};

type BatchWithAnimals = FatteningBatch & {
  animals: (FatteningBatchAnimal & { animal: AnimalProfile })[];
};

export function toFatteningBatchJsonDto(
  row: BatchWithCount | FatteningBatch,
  animalCount?: number,
): FatteningBatchJsonDto {
  const count =
    animalCount ??
    ("_count" in row ? row._count.animals : undefined) ??
    0;
  return {
    id: row.id,
    farmId: row.farmId,
    name: row.name,
    goalType: row.goalType,
    goal: row.goal,
    startDate: formatDateOnly(row.startDate),
    targetDate: formatDateOnly(row.targetDate),
    status: row.status,
    animalCount: count,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFatteningBatchDetailDto(row: BatchWithAnimals) {
  const activeMemberships = row.animals.filter((m) => m.removedAt == null);
  return {
    batch: toFatteningBatchJsonDto(row, activeMemberships.length),
    animals: activeMemberships.map((m) => toAnimalJsonDto(m.animal)),
  };
}
