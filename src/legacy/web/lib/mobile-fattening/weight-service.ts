import { FatteningBatchStatus, Prisma, WeightRecordMethod } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  buildBatchWeightProgress,
  formatDateOnly,
  startOfDayUtc,
  syncAnimalWeightFromLatestRecord,
} from "./batch-weight-snapshot";
import { toWeightRecordJsonDto, type WeightRecordJsonDto } from "./weight-mapper";
import type { CreateWeightBody, ListWeightQuery } from "./weight-schemas";

const weightInclude = {
  animal: { select: { name: true } },
} as const;

async function assertAnimalInBatch(
  customerId: string,
  batchId: string,
  animalId: string,
): Promise<void> {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");
  if (
    batch.status !== FatteningBatchStatus.ACTIVE &&
    batch.status !== FatteningBatchStatus.COMPLETED
  ) {
    throw new Error("BATCH_NOT_ACTIVE");
  }

  const membership = await prisma.fatteningBatchAnimal.findFirst({
    where: {
      batchId,
      animalId,
      removedAt: null,
      animal: { customerId, active: true },
    },
  });
  if (!membership) throw new Error("ANIMAL_NOT_IN_BATCH");
}

function resolveRecordedOn(body: CreateWeightBody, recordedAt: Date): Date {
  if (body.recordedOn) {
    return startOfDayUtc(new Date(`${body.recordedOn}T00:00:00.000Z`));
  }
  return startOfDayUtc(recordedAt);
}

export async function createWeightRecordForCustomer(
  customerId: string,
  body: CreateWeightBody,
): Promise<WeightRecordJsonDto> {
  await assertAnimalInBatch(customerId, body.batchId, body.animalId);

  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error("INVALID_RECORDED_AT");
  }

  const recordedOn = resolveRecordedOn(body, recordedAt);
  const method = body.method ?? WeightRecordMethod.SCALE;

  const existing = await prisma.weightRecord.findUnique({
    where: {
      batchId_animalId_recordedOn: {
        batchId: body.batchId,
        animalId: body.animalId,
        recordedOn,
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("DUPLICATE_WEIGHT_DAY");
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.weightRecord.create({
        data: {
          customerId,
          animalId: body.animalId,
          batchId: body.batchId,
          weightKg: new Prisma.Decimal(body.weightKg.toFixed(3)),
          recordedAt,
          recordedOn,
          method,
          note: body.note?.trim() || undefined,
          photoUrl: body.photoUrl?.trim() || undefined,
        },
        include: weightInclude,
      });

      await syncAnimalWeightFromLatestRecord(tx, body.animalId);
      return created;
    });

    return toWeightRecordJsonDto(row);
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error("DUPLICATE_WEIGHT_DAY");
    }
    throw e;
  }
}

export async function listWeightRecordsForCustomer(
  customerId: string,
  query: ListWeightQuery,
) {
  const batch = await prisma.fatteningBatch.findFirst({
    where: { id: query.batchId, customerId },
  });
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  const where: Prisma.WeightRecordWhereInput = {
    customerId,
    batchId: query.batchId,
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.from || query.to
      ? {
          recordedAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.weightRecord.count({ where }),
    prisma.weightRecord.findMany({
      where,
      include: weightInclude,
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    records: rows.map(toWeightRecordJsonDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function listWeightHistoryForCustomer(
  customerId: string,
  query: ListWeightQuery,
) {
  const [list, snapshot] = await Promise.all([
    listWeightRecordsForCustomer(customerId, query),
    buildBatchWeightProgress(customerId, query.batchId),
  ]);

  return {
    ...list,
    progress: snapshot.progress,
    growth: snapshot.growth,
    totalGainKg: snapshot.totalGainKg,
    avgCurrentWeightKg: snapshot.avgCurrentWeightKg,
  };
}

export async function getBatchProgressForCustomer(
  customerId: string,
  batchId: string,
) {
  return buildBatchWeightProgress(customerId, batchId);
}

export { formatDateOnly };
