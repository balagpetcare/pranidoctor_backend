import { FatteningBatchGoalType, FatteningBatchStatus } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { round2, startOfDayUtc } from "@/lib/mobile-feeds/feed-mapper";

import { buildBatchWeightProgress } from "./batch-weight-snapshot";
import { computeGainKg } from "./weight-mapper";
import {
  QURBANI_AT_RISK_THRESHOLD,
  QURBANI_READY_THRESHOLD,
  QURBANI_TARGET_WEIGHT_KG,
} from "./qurbani-constants";

export type QurbaniReadinessStatus =
  | "NOT_STARTED"
  | "ON_TRACK"
  | "AT_RISK"
  | "READY"
  | "OVERDUE";

export type QurbaniCountdownDto = {
  targetDate: string | null;
  daysRemaining: number | null;
  isPast: boolean;
  label: string | null;
};

export type QurbaniAnimalReadinessDto = {
  animalId: string;
  animalName: string;
  initialWeightKg: string | null;
  currentWeightKg: string | null;
  gainKg: string | null;
  targetWeightKg: number;
  progressPct: number;
  recordCount: number;
};

export type QurbaniDashboardDto = {
  batchId: string;
  goalType: FatteningBatchGoalType;
  countdown: QurbaniCountdownDto;
  readiness: {
    scorePct: number;
    status: QurbaniReadinessStatus;
    weightProgressPct: number | null;
    timeProgressPct: number | null;
    animalCount: number;
    animalsWithWeights: number;
  };
  animals: QurbaniAnimalReadinessDto[];
};

async function assertBatchOwned(customerId: string, batchId: string) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  return batch;
}

function msPerDay() {
  return 24 * 60 * 60 * 1000;
}

function computeCountdown(targetDate: Date | null): QurbaniCountdownDto {
  if (!targetDate) {
    return {
      targetDate: null,
      daysRemaining: null,
      isPast: false,
      label: null,
    };
  }

  const target = startOfDayUtc(targetDate);
  const today = startOfDayUtc(new Date());
  const diffMs = target.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / msPerDay());
  const isPast = daysRemaining < 0;
  const absDays = Math.abs(daysRemaining);

  let label: string;
  if (daysRemaining === 0) {
    label = "Eid day";
  } else if (isPast) {
    label = absDays === 1 ? "1 day past target" : `${absDays} days past target`;
  } else {
    label = absDays === 1 ? "1 day to Qurbani" : `${absDays} days to Qurbani`;
  }

  return {
    targetDate: target.toISOString().slice(0, 10),
    daysRemaining,
    isPast,
    label,
  };
}

function computeTimeProgressPct(
  startDate: Date | null,
  targetDate: Date | null,
): number | null {
  if (!startDate || !targetDate) return null;
  const start = startOfDayUtc(startDate).getTime();
  const target = startOfDayUtc(targetDate).getTime();
  const today = startOfDayUtc(new Date()).getTime();
  if (target <= start) return null;
  const elapsed = today - start;
  const span = target - start;
  return round2(Math.min(100, Math.max(0, (elapsed / span) * 100)));
}

function weightProgressPct(currentKg: number | null): number {
  if (currentKg == null || currentKg <= 0) return 0;
  return round2(Math.min(100, (currentKg / QURBANI_TARGET_WEIGHT_KG) * 100));
}

function resolveReadinessStatus(
  scorePct: number,
  daysRemaining: number | null,
  batchStatus: FatteningBatchStatus,
): QurbaniReadinessStatus {
  if (batchStatus === FatteningBatchStatus.DRAFT) return "NOT_STARTED";
  if (scorePct >= QURBANI_READY_THRESHOLD) return "READY";
  if (daysRemaining != null && daysRemaining < 0 && scorePct < QURBANI_READY_THRESHOLD) {
    return "OVERDUE";
  }
  if (
    daysRemaining != null &&
    daysRemaining <= 14 &&
    scorePct < QURBANI_AT_RISK_THRESHOLD
  ) {
    return "AT_RISK";
  }
  return "ON_TRACK";
}

export async function getQurbaniDashboardForCustomer(
  customerId: string,
  batchId: string,
): Promise<QurbaniDashboardDto> {
  const batch = await assertBatchOwned(customerId, batchId);
  const countdown = computeCountdown(batch.targetDate);

  const snapshot = await buildBatchWeightProgress(customerId, batchId);

  const animals: QurbaniAnimalReadinessDto[] = snapshot.progress.map((p) => {
    const currentNum =
      p.currentWeightKg != null ? Number(p.currentWeightKg) : null;
    return {
      animalId: p.animalId,
      animalName: p.animalName,
      initialWeightKg: p.initialWeightKg,
      currentWeightKg: p.currentWeightKg,
      gainKg: p.gainKg,
      targetWeightKg: QURBANI_TARGET_WEIGHT_KG,
      progressPct: weightProgressPct(
        currentNum != null && !Number.isNaN(currentNum) ? currentNum : null,
      ),
      recordCount: p.recordCount,
    };
  });

  const progressValues = animals.map((a) => a.progressPct);
  const weightProgressPct =
    progressValues.length > 0
      ? round2(
          progressValues.reduce((sum, v) => sum + v, 0) / progressValues.length,
        )
      : null;

  const timeProgressPct = computeTimeProgressPct(batch.startDate, batch.targetDate);

  let scorePct = 0;
  if (weightProgressPct != null && timeProgressPct != null) {
    scorePct = round2(weightProgressPct * 0.6 + timeProgressPct * 0.4);
  } else if (weightProgressPct != null) {
    scorePct = weightProgressPct;
  } else if (timeProgressPct != null) {
    scorePct = timeProgressPct;
  }

  const animalsWithWeights = animals.filter(
    (a) => a.currentWeightKg != null && a.recordCount > 0,
  ).length;

  const status = resolveReadinessStatus(
    scorePct,
    countdown.daysRemaining,
    batch.status,
  );

  return {
    batchId,
    goalType: batch.goalType,
    countdown,
    readiness: {
      scorePct,
      status,
      weightProgressPct,
      timeProgressPct,
      animalCount: animals.length,
      animalsWithWeights,
    },
    animals,
  };
}
