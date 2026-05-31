import { AnimalWeightMethod, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type AnimalWeightAdminAnalytics = {
  period: { from: string; to: string };
  totals: {
    measurements: number;
    aiJobs: number;
    aiSucceeded: number;
    aiFailed: number;
  };
  byMethod: Array<{ method: AnimalWeightMethod; count: number }>;
  avgAiConfidence: string | null;
  avgDeltaTapeVsScale: string | null;
};

export async function getAnimalWeightAdminAnalytics(
  from: Date,
  to: Date,
): Promise<AnimalWeightAdminAnalytics> {
  const whereMeasured: Prisma.AnimalWeightMeasurementWhereInput = {
    measuredAt: { gte: from, lte: to },
  };

  const [measurementCount, byMethod, aiStats, tapeRows, scaleRows] =
    await Promise.all([
      prisma.animalWeightMeasurement.count({ where: whereMeasured }),
      prisma.animalWeightMeasurement.groupBy({
        by: ["method"],
        where: whereMeasured,
        _count: { id: true },
      }),
      prisma.animalWeightAiJob.groupBy({
        by: ["status"],
        where: { requestedAt: { gte: from, lte: to } },
        _count: { id: true },
      }),
      prisma.animalWeightMeasurement.findMany({
        where: {
          ...whereMeasured,
          method: AnimalWeightMethod.TAPE,
        },
        select: { animalId: true, weightKg: true, measuredAt: true },
      }),
      prisma.animalWeightMeasurement.findMany({
        where: {
          ...whereMeasured,
          method: AnimalWeightMethod.SCALE,
        },
        select: { animalId: true, weightKg: true, measuredAt: true },
      }),
    ]);

  const aiJobTotal = aiStats.reduce((s, r) => s + r._count.id, 0);
  const aiSucceeded =
    aiStats.find((r) => r.status === "SUCCEEDED")?._count.id ?? 0;
  const aiFailed = aiStats.find((r) => r.status === "FAILED")?._count.id ?? 0;

  const confidenceAgg = await prisma.animalWeightMeasurement.aggregate({
    where: {
      ...whereMeasured,
      method: AnimalWeightMethod.AI_CAMERA,
      aiConfidence: { not: null },
    },
    _avg: { aiConfidence: true },
  });

  let deltaSum = 0;
  let deltaCount = 0;
  for (const tape of tapeRows) {
    const scale = scaleRows.find(
      (s) =>
        s.animalId === tape.animalId &&
        Math.abs(s.measuredAt.getTime() - tape.measuredAt.getTime()) <
          7 * 24 * 60 * 60 * 1000,
    );
    if (scale) {
      deltaSum += Math.abs(Number(tape.weightKg) - Number(scale.weightKg));
      deltaCount += 1;
    }
  }

  return {
    period: {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    totals: {
      measurements: measurementCount,
      aiJobs: aiJobTotal,
      aiSucceeded,
      aiFailed,
    },
    byMethod: byMethod.map((r) => ({
      method: r.method,
      count: r._count.id,
    })),
    avgAiConfidence: confidenceAgg._avg.aiConfidence
      ? Number(confidenceAgg._avg.aiConfidence).toFixed(4)
      : null,
    avgDeltaTapeVsScale:
      deltaCount > 0 ? (deltaSum / deltaCount).toFixed(3) : null,
  };
}
