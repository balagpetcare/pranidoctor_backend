import {
  AnimalType,
  AnimalWeightAiJobStatus,
  AnimalWeightMeasurementSource,
  AnimalWeightMethod,
  Prisma,
} from "@/generated/prisma/client";

import { createAuditLog } from "../../../../shared/security/audit/audit.service.js";
import { prisma } from "@/lib/prisma";

import {
  toAiJobJsonDto,
  toMeasurementJsonDto,
  type AnimalWeightMeasurementJsonDto,
} from "./animal-weight-mapper.js";
import type {
  CreateAiJobBody,
  CreateMeasurementBody,
  ListMeasurementsQuery,
  TapePreviewBody,
  WeightCaptureBody,
} from "./animal-weight-schemas.js";
import { scheduleAnimalWeightAiJob } from "./animal-weight-ai.scheduler.js";
import { mirrorAnimalProfileWeight } from "./animal-weight-profile.util.js";
import {
  estimateWeightFromTape,
  isTapeSupported,
  roundWeightKg,
} from "./tape-formula-registry.js";

function resolveMeasuredTimes(capture: WeightCaptureBody): {
  measuredAt: Date;
  measuredOn: Date;
} {
  const measuredAt = capture.measuredAt
    ? new Date(capture.measuredAt)
    : new Date();
  if (Number.isNaN(measuredAt.getTime())) {
    throw new Error("INVALID_MEASURED_AT");
  }
  if (measuredAt > new Date(Date.now() + 5 * 60 * 1000)) {
    throw new Error("INVALID_MEASURED_AT");
  }

  let measuredOn: Date;
  if (capture.measuredOn) {
    measuredOn = new Date(`${capture.measuredOn}T00:00:00.000Z`);
  } else {
    measuredOn = new Date(
      Date.UTC(
        measuredAt.getUTCFullYear(),
        measuredAt.getUTCMonth(),
        measuredAt.getUTCDate(),
      ),
    );
  }
  if (Number.isNaN(measuredOn.getTime())) {
    throw new Error("INVALID_MEASURED_ON");
  }

  return { measuredAt, measuredOn };
}

async function assertAnimalOwned(
  customerId: string,
  animalId: string,
): Promise<{ id: string; animalType: AnimalType | null }> {
  const animal = await prisma.animalProfile.findFirst({
    where: { id: animalId, customerId },
    select: { id: true, animalType: true },
  });
  if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  return animal;
}

async function checkClientIdempotency(
  customerId: string,
  clientMeasurementId?: string,
): Promise<AnimalWeightMeasurementJsonDto | null> {
  if (!clientMeasurementId?.trim()) return null;
  const existing = await prisma.animalWeightMeasurement.findFirst({
    where: { customerId, clientMeasurementId: clientMeasurementId.trim() },
  });
  return existing ? toMeasurementJsonDto(existing) : null;
}

export async function previewTapeWeight(body: TapePreviewBody) {
  if (!isTapeSupported(body.animalType)) {
    throw new Error("TAPE_NOT_SUPPORTED");
  }
  const result = estimateWeightFromTape({
    animalType: body.animalType,
    heartGirthCm: body.heartGirthCm,
    bodyLengthCm: body.bodyLengthCm,
  });
  return {
    formulaId: result.formulaId,
    estimatedKg: roundWeightKg(result.estimatedKg),
    lowConfidence: result.lowConfidence,
  };
}

export async function createMeasurementFromCapture(
  customerId: string,
  animalId: string,
  animalType: AnimalType | null,
  capture: WeightCaptureBody,
  source: AnimalWeightMeasurementSource = AnimalWeightMeasurementSource.REGISTRATION,
): Promise<{
  measurement: AnimalWeightMeasurementJsonDto;
  aiJob?: ReturnType<typeof toAiJobJsonDto>;
}> {
  const dup = await checkClientIdempotency(
    customerId,
    capture.clientMeasurementId,
  );
  if (dup) {
    const err = new Error("DUPLICATE_CLIENT_MEASUREMENT");
    (err as Error & { existing: AnimalWeightMeasurementJsonDto }).existing =
      dup;
    throw err;
  }

  const { measuredAt, measuredOn } = resolveMeasuredTimes(capture);

  if (capture.method === "AI_CAMERA") {
    return createAiCaptureMeasurement(
      customerId,
      animalId,
      animalType,
      capture,
      source,
      measuredAt,
      measuredOn,
    );
  }

  const data = buildMeasurementData(
    customerId,
    animalId,
    capture,
    source,
    measuredAt,
    measuredOn,
    animalType,
  );

  const measurement = await prisma.$transaction(async (tx) => {
    const row = await tx.animalWeightMeasurement.create({ data });
    await mirrorAnimalProfileWeight(tx, animalId, {
      weightKg: row.weightKg,
      method: row.method,
      measuredAt: row.measuredAt,
    });
    return row;
  });

  await createAuditLog({
    action: "ANIMAL_WEIGHT_MEASUREMENT_CREATED",
    actorType: "user",
    targetType: "AnimalProfile",
    targetId: animalId,
    resourceType: "AnimalWeightMeasurement",
    resourceId: measurement.id,
    details: {
      method: measurement.method,
      weightKg: measurement.weightKg.toString(),
      source,
    },
  });

  return { measurement: toMeasurementJsonDto(measurement) };
}

function buildMeasurementData(
  customerId: string,
  animalId: string,
  capture: WeightCaptureBody,
  source: AnimalWeightMeasurementSource,
  measuredAt: Date,
  measuredOn: Date,
  animalType: AnimalType | null,
): Prisma.AnimalWeightMeasurementCreateInput {
  const base = {
    customer: { connect: { id: customerId } },
    animal: { connect: { id: animalId } },
    source,
    measuredAt,
    measuredOn,
    note: capture.note?.trim() || undefined,
    clientMeasurementId: capture.clientMeasurementId?.trim() || undefined,
  };

  if (capture.method === "TAPE") {
    const type = animalType ?? AnimalType.OTHER;
    if (!isTapeSupported(type)) throw new Error("TAPE_NOT_SUPPORTED");
    const tape = estimateWeightFromTape({
      animalType: type,
      heartGirthCm: capture.heartGirthCm,
      bodyLengthCm: capture.bodyLengthCm,
    });
    const weightKg = new Prisma.Decimal(roundWeightKg(tape.estimatedKg));
    return {
      ...base,
      method: AnimalWeightMethod.TAPE,
      weightKg,
      heartGirthCm: new Prisma.Decimal(capture.heartGirthCm.toFixed(2)),
      bodyLengthCm: new Prisma.Decimal(capture.bodyLengthCm.toFixed(2)),
      tapeFormulaId: tape.formulaId,
      tapeEstimatedKg: weightKg,
    };
  }

  if (capture.method === "SCALE") {
    return {
      ...base,
      method: AnimalWeightMethod.SCALE,
      weightKg: new Prisma.Decimal(roundWeightKg(capture.weightKg)),
      scalePhotoUrl: capture.scalePhotoUrl?.trim() || undefined,
    };
  }

  throw new Error("UNSUPPORTED_CAPTURE_METHOD");
}

async function createAiCaptureMeasurement(
  customerId: string,
  animalId: string,
  animalType: AnimalType | null,
  capture: Extract<WeightCaptureBody, { method: "AI_CAMERA" }>,
  source: AnimalWeightMeasurementSource,
  measuredAt: Date,
  measuredOn: Date,
): Promise<{
  measurement?: AnimalWeightMeasurementJsonDto;
  aiJob: ReturnType<typeof toAiJobJsonDto>;
}> {
  const uploadIds = capture.uploadIds ?? [];
  const job = await prisma.animalWeightAiJob.create({
    data: {
      customerId,
      animalId,
      animalType: animalType ?? undefined,
      status: AnimalWeightAiJobStatus.PENDING,
      uploadIds,
      videoUploadId: capture.videoUploadId ?? undefined,
    },
  });

  scheduleAnimalWeightAiJob(job.id);

  await createAuditLog({
    action: "ANIMAL_WEIGHT_AI_JOB_STARTED",
    actorType: "user",
    targetType: "AnimalProfile",
    targetId: animalId,
    resourceType: "AnimalWeightAiJob",
    resourceId: job.id,
    details: { uploadCount: uploadIds.length },
  });

  return { aiJob: toAiJobJsonDto(job) };
}

export async function createMeasurementForAnimal(
  customerId: string,
  animalId: string,
  body: CreateMeasurementBody,
) {
  const animal = await assertAnimalOwned(customerId, animalId);
  return createMeasurementFromCapture(
    customerId,
    animalId,
    animal.animalType,
    body.weightCapture,
    body.source ?? AnimalWeightMeasurementSource.ANIMAL_DETAIL,
  );
}

export async function listMeasurementsForAnimal(
  customerId: string,
  animalId: string,
  query: ListMeasurementsQuery,
) {
  await assertAnimalOwned(customerId, animalId);

  const where: Prisma.AnimalWeightMeasurementWhereInput = {
    customerId,
    animalId,
    ...(query.method ? { method: query.method } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.animalWeightMeasurement.count({ where }),
    prisma.animalWeightMeasurement.findMany({
      where,
      orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return {
    records: rows.map(toMeasurementJsonDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function getCurrentWeightForAnimal(
  customerId: string,
  animalId: string,
) {
  const animal = await prisma.animalProfile.findFirst({
    where: { id: animalId, customerId },
    select: {
      weightKg: true,
      lastWeightMethod: true,
      lastWeightMeasuredAt: true,
    },
  });
  if (!animal) throw new Error("ANIMAL_NOT_FOUND");

  const latest = await prisma.animalWeightMeasurement.findFirst({
    where: { customerId, animalId },
    orderBy: [{ measuredAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    weightKg: animal.weightKg?.toString() ?? null,
    lastWeightMethod: animal.lastWeightMethod,
    lastWeightMeasuredAt: animal.lastWeightMeasuredAt?.toISOString() ?? null,
    latestMeasurement: latest ? toMeasurementJsonDto(latest) : null,
  };
}

export async function createAiJobForAnimal(
  customerId: string,
  animalId: string,
  body: CreateAiJobBody,
) {
  const animal = await assertAnimalOwned(customerId, animalId);

  const job = await prisma.animalWeightAiJob.create({
    data: {
      customerId,
      animalId,
      animalType: animal.animalType ?? undefined,
      status: AnimalWeightAiJobStatus.PENDING,
      uploadIds: body.uploadIds ?? [],
      videoUploadId: body.videoUploadId,
      registrationDraftId: body.registrationDraftId,
    },
  });

  scheduleAnimalWeightAiJob(job.id);
  return { job: toAiJobJsonDto(job) };
}

export async function getWeightAccuracyForAnimal(
  customerId: string,
  animalId: string,
  windowDays = 90,
) {
  await assertAnimalOwned(customerId, animalId);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - windowDays);

  const rows = await prisma.animalWeightMeasurement.findMany({
    where: {
      customerId,
      animalId,
      measuredAt: { gte: since },
      method: { in: [AnimalWeightMethod.SCALE, AnimalWeightMethod.TAPE, AnimalWeightMethod.AI_CAMERA] },
    },
    orderBy: { measuredAt: "desc" },
  });

  const scales = rows.filter((r) => r.method === AnimalWeightMethod.SCALE);
  const reference = scales[0];
  if (!reference) {
    return {
      animalId,
      referenceMethod: "SCALE",
      windowDays,
      pairs: [],
      disclaimer: "Comparisons are informational only. Log a scale weight as reference.",
    };
  }

  const refKg = Number(reference.weightKg);
  const compareMethods = [AnimalWeightMethod.TAPE, AnimalWeightMethod.AI_CAMERA] as const;

  const pairs = compareMethods.map((method) => {
    const samples = rows.filter((r) => r.method === method);
    if (samples.length === 0) {
      return {
        compareMethod: method,
        sampleCount: 0,
        meanDeltaKg: null,
        meanDeltaPercent: null,
        lastComparedAt: null,
      };
    }
    const deltas = samples.map((s) => Number(s.weightKg) - refKg);
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const meanPct = refKg !== 0 ? (meanDelta / refKg) * 100 : 0;
    return {
      compareMethod: method,
      sampleCount: samples.length,
      meanDeltaKg: meanDelta.toFixed(3),
      meanDeltaPercent: meanPct.toFixed(2),
      lastComparedAt: samples[0].measuredOn.toISOString().slice(0, 10),
    };
  });

  return {
    animalId,
    referenceMethod: "SCALE",
    referenceKg: reference.weightKg.toString(),
    windowDays,
    pairs,
    disclaimer: "Comparisons are informational only.",
  };
}

export { getAiJobForCustomer } from "./animal-weight-ai.processor.js";
