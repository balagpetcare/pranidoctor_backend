import {
  AnimalType,
  FatteningBatchGoalType,
  FatteningBatchStatus,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  formatDateOnly,
  parseDateOnly,
  toFatteningBatchDetailDto,
  toFatteningBatchJsonDto,
  type FatteningBatchJsonDto,
} from "./fattening-mapper";
import type {
  AddFatteningBatchAnimalsBody,
  CreateFatteningBatchBody,
  ListFatteningBatchesQuery,
  StartFatteningBatchBody,
} from "./schemas";

const activeMembershipWhere = {
  removedAt: null,
} as const;

const batchAnimalCount = {
  where: activeMembershipWhere,
} as const;

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function findActiveBatchConflict(
  customerId: string,
  animalIds: string[],
  excludeBatchId?: string,
): Promise<string | null> {
  if (animalIds.length === 0) return null;

  const conflict = await prisma.fatteningBatchAnimal.findFirst({
    where: {
      animalId: { in: animalIds },
      removedAt: null,
      batch: {
        customerId,
        status: FatteningBatchStatus.ACTIVE,
        ...(excludeBatchId ? { id: { not: excludeBatchId } } : {}),
      },
    },
    select: { animalId: true },
  });

  return conflict?.animalId ?? null;
}

async function validateCattleAnimals(
  customerId: string,
  animalIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(animalIds)];
  const animals = await prisma.animalProfile.findMany({
    where: {
      id: { in: uniqueIds },
      customerId,
      active: true,
    },
    select: { id: true, animalType: true },
  });

  if (animals.length !== uniqueIds.length) {
    throw new Error("ANIMAL_NOT_FOUND");
  }

  const nonCattle = animals.find((a) => a.animalType !== AnimalType.CATTLE);
  if (nonCattle) {
    throw new Error("ANIMAL_TYPE_NOT_SUPPORTED");
  }
}

export async function listFatteningBatchesForCustomer(
  customerId: string,
  query: ListFatteningBatchesQuery,
): Promise<{
  batches: FatteningBatchJsonDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const where: Prisma.FatteningBatchWhereInput = {
    customerId,
    farmId: query.farmId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.fatteningBatch.count({ where }),
    prisma.fatteningBatch.findMany({
      where,
      include: { _count: { select: { animals: batchAnimalCount } } },
      orderBy: [{ updatedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    batches: rows.map((row) => toFatteningBatchJsonDto(row)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function createFatteningBatchForCustomer(
  customerId: string,
  body: CreateFatteningBatchBody,
): Promise<FatteningBatchJsonDto> {
  const row = await prisma.fatteningBatch.create({
    data: {
      customerId,
      farmId: body.farmId,
      name: body.name.trim(),
      goalType: body.goalType ?? FatteningBatchGoalType.NORMAL,
      goal: body.goal?.trim() || undefined,
      targetDate: body.targetDate
        ? parseDateOnly(body.targetDate)
        : undefined,
      status: FatteningBatchStatus.DRAFT,
    },
    include: { _count: { select: { animals: batchAnimalCount } } },
  });
  return toFatteningBatchJsonDto(row);
}

export async function getFatteningBatchForCustomer(
  customerId: string,
  batchId: string,
) {
  const row = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
    include: {
      animals: {
        where: activeMembershipWhere,
        include: { animal: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!row) return null;
  return toFatteningBatchDetailDto(row);
}

export async function addAnimalsToFatteningBatch(
  customerId: string,
  batchId: string,
  body: AddFatteningBatchAnimalsBody,
) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) return null;
  if (batch.status !== FatteningBatchStatus.DRAFT) {
    throw new Error("BATCH_NOT_DRAFT");
  }

  const animalIds = [...new Set(body.animalIds)];
  await validateCattleAnimals(customerId, animalIds);

  const memberships = await prisma.fatteningBatchAnimal.findMany({
    where: { batchId, animalId: { in: animalIds } },
  });
  const byAnimalId = new Map(memberships.map((m) => [m.animalId, m]));

  await prisma.$transaction(async (tx) => {
    for (const animalId of animalIds) {
      const existing = byAnimalId.get(animalId);
      if (existing) {
        if (existing.removedAt != null) {
          await tx.fatteningBatchAnimal.update({
            where: { id: existing.id },
            data: { removedAt: null, joinedAt: new Date() },
          });
        }
        continue;
      }
      await tx.fatteningBatchAnimal.create({
        data: { batchId, animalId },
      });
    }
  });

  return getFatteningBatchForCustomer(customerId, batchId);
}

export async function startFatteningBatchForCustomer(
  customerId: string,
  batchId: string,
  body: StartFatteningBatchBody,
) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
    include: {
      animals: {
        where: activeMembershipWhere,
        select: { animalId: true },
      },
    },
  });
  if (!batch) return null;
  if (batch.status !== FatteningBatchStatus.DRAFT) {
    throw new Error("BATCH_NOT_DRAFT");
  }
  if (batch.animals.length === 0) {
    throw new Error("BATCH_EMPTY");
  }

  const animalIds = batch.animals.map((a) => a.animalId);
  const conflictId = await findActiveBatchConflict(
    customerId,
    animalIds,
    batchId,
  );
  if (conflictId) {
    throw new Error("ANIMAL_ALREADY_IN_ACTIVE_BATCH");
  }

  const startDate = body.startDate
    ? parseDateOnly(body.startDate)
    : startOfTodayUtc();

  const createdDay = new Date(batch.createdAt);
  createdDay.setUTCHours(0, 0, 0, 0);
  if (startDate < createdDay) {
    throw new Error("INVALID_START_DATE");
  }

  const maxFuture = startOfTodayUtc();
  maxFuture.setUTCDate(maxFuture.getUTCDate() + 7);
  if (startDate > maxFuture) {
    throw new Error("INVALID_START_DATE");
  }

  if (batch.targetDate && startDate > batch.targetDate) {
    throw new Error("INVALID_START_DATE");
  }

  await prisma.fatteningBatch.update({
    where: { id: batchId },
    data: {
      status: FatteningBatchStatus.ACTIVE,
      startDate,
    },
  });

  return getFatteningBatchForCustomer(customerId, batchId);
}

export { formatDateOnly };
