import { prisma } from "@/lib/prisma";

import { computeGainKg } from "./weight-mapper";

export type AnimalWeightProgressDto = {
  animalId: string;
  animalName: string;
  initialWeightKg: string | null;
  currentWeightKg: string | null;
  gainKg: string | null;
  recordCount: number;
  lastRecordedOn: string | null;
};

export type BatchWeightGrowthPointDto = {
  recordedOn: string;
  totalWeightKg: number;
  avgWeightKg: number;
};

export type BatchWeightProgressDto = {
  batchId: string;
  progress: AnimalWeightProgressDto[];
  growth: BatchWeightGrowthPointDto[];
  totalGainKg: number | null;
  avgCurrentWeightKg: number | null;
};

function startOfDayUtc(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildBatchWeightProgress(
  customerId: string,
  batchId: string,
): Promise<BatchWeightProgressDto> {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  const memberships = await prisma.fatteningBatchAnimal.findMany({
    where: { batchId, removedAt: null, batch: { customerId } },
    include: { animal: { select: { id: true, name: true, weightKg: true } } },
    orderBy: { joinedAt: "asc" },
  });

  if (memberships.length === 0) {
    return {
      batchId,
      progress: [],
      growth: [],
      totalGainKg: null,
      avgCurrentWeightKg: null,
    };
  }

  const animalIds = memberships.map((m) => m.animalId);
  const records = await prisma.weightRecord.findMany({
    where: { customerId, batchId, animalId: { in: animalIds } },
    orderBy: [{ recordedOn: "asc" }, { recordedAt: "asc" }],
  });

  const byAnimal = new Map<string, typeof records>();
  for (const record of records) {
    const list = byAnimal.get(record.animalId) ?? [];
    list.push(record);
    byAnimal.set(record.animalId, list);
  }

  const progress: AnimalWeightProgressDto[] = memberships.map((m) => {
    const animalRecords = byAnimal.get(m.animalId) ?? [];
    const first = animalRecords[0];
    const last = animalRecords[animalRecords.length - 1];
    const initial =
      first != null
        ? first.weightKg.toString()
        : m.animal.weightKg?.toString() ?? null;
    const current =
      last != null
        ? last.weightKg.toString()
        : m.animal.weightKg?.toString() ?? null;
    return {
      animalId: m.animalId,
      animalName: m.animal.name,
      initialWeightKg: initial,
      currentWeightKg: current,
      gainKg: computeGainKg(initial, current),
      recordCount: animalRecords.length,
      lastRecordedOn: last ? formatDateOnly(last.recordedOn) : null,
    };
  });

  const byDay = new Map<string, { sum: number; count: number }>();
  for (const record of records) {
    const key = formatDateOnly(record.recordedOn);
    const entry = byDay.get(key) ?? { sum: 0, count: 0 };
    entry.sum += Number(record.weightKg);
    entry.count += 1;
    byDay.set(key, entry);
  }

  const growth: BatchWeightGrowthPointDto[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([recordedOn, { sum, count }]) => ({
      recordedOn,
      totalWeightKg: Math.round(sum * 1000) / 1000,
      avgWeightKg: Math.round((sum / count) * 1000) / 1000,
    }));

  const gains = progress
    .map((p) => (p.gainKg != null ? Number(p.gainKg) : NaN))
    .filter((n) => !Number.isNaN(n));
  const currents = progress
    .map((p) => (p.currentWeightKg != null ? Number(p.currentWeightKg) : NaN))
    .filter((n) => !Number.isNaN(n));

  return {
    batchId,
    progress,
    growth,
    totalGainKg:
      gains.length > 0
        ? Math.round(gains.reduce((a, b) => a + b, 0) * 1000) / 1000
        : null,
    avgCurrentWeightKg:
      currents.length > 0
        ? Math.round(
            (currents.reduce((a, b) => a + b, 0) / currents.length) * 1000,
          ) / 1000
        : null,
  };
}

export async function syncAnimalWeightFromLatestRecord(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  animalId: string,
): Promise<void> {
  const latest = await tx.weightRecord.findFirst({
    where: { animalId },
    orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
  });
  if (!latest) return;
  await tx.animalProfile.update({
    where: { id: animalId },
    data: { weightKg: latest.weightKg },
  });
}

export { startOfDayUtc, formatDateOnly };
