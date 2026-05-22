import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  parseDateOnly,
  startOfDayUtc,
  toHealthEventJsonDto,
  type HealthEventJsonDto,
} from "./health-mapper";
import type { CreateHealthBody, ListHealthQuery, PatchHealthBody } from "./schemas";

const include = { animal: { select: { name: true } } } as const;

function defaultRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const toDate = to ? parseDateOnly(to) : startOfDayUtc(now);
  const fromDate = from
    ? parseDateOnly(from)
    : new Date(toDate.getTime() - 89 * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

export async function listHealthHistoryForCustomer(
  customerProfileId: string,
  query: ListHealthQuery,
): Promise<{ records: HealthEventJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const { from, to } = defaultRange(query.from, query.to);
  const where: Prisma.HealthEventWhereInput = {
    customerId: customerProfileId,
    recordedDate: { gte: from, lte: to },
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { notes: { contains: query.search, mode: "insensitive" } },
            { diseaseName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.healthEvent.count({ where }),
    prisma.healthEvent.findMany({
      where,
      include,
      orderBy: [{ recordedDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    records: rows.map(toHealthEventJsonDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function timelineForCustomer(
  customerProfileId: string,
  query: ListHealthQuery,
): Promise<{
  groups: { date: string; events: HealthEventJsonDto[] }[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const list = await listHealthHistoryForCustomer(customerProfileId, query);
  const byDate = new Map<string, HealthEventJsonDto[]>();
  for (const record of list.records) {
    const bucket = byDate.get(record.recordedDate) ?? [];
    bucket.push(record);
    byDate.set(record.recordedDate, bucket);
  }
  const groups = [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, events]) => ({ date, events }));

  return {
    groups,
    total: list.total,
    page: list.page,
    limit: list.limit,
    hasMore: list.hasMore,
  };
}

export async function createHealthForCustomer(
  customerProfileId: string,
  body: CreateHealthBody,
): Promise<HealthEventJsonDto> {
  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const row = await prisma.healthEvent.create({
    data: {
      customerId: customerProfileId,
      animalId: body.animalId,
      farmRef: body.farmRef?.trim() || undefined,
      eventType: body.eventType,
      title: body.title.trim(),
      symptoms: body.symptoms?.trim() || undefined,
      diagnosis: body.diagnosis?.trim() || undefined,
      diseaseName: body.diseaseName?.trim() || undefined,
      treatmentRefId: body.treatmentRefId?.trim() || undefined,
      vaccineRefId: body.vaccineRefId?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      recordedDate: parseDateOnly(body.recordedDate),
    },
    include,
  });
  return toHealthEventJsonDto(row);
}

export async function getHealthForCustomer(
  customerProfileId: string,
  id: string,
): Promise<HealthEventJsonDto | null> {
  const row = await prisma.healthEvent.findFirst({
    where: { id, customerId: customerProfileId },
    include,
  });
  return row ? toHealthEventJsonDto(row) : null;
}

export async function patchHealthForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchHealthBody,
): Promise<HealthEventJsonDto | null> {
  const existing = await prisma.healthEvent.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return null;

  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const data: Prisma.HealthEventUpdateInput = {};
  if (body.animalId !== undefined) data.animal = body.animalId ? { connect: { id: body.animalId } } : { disconnect: true };
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.eventType !== undefined) data.eventType = body.eventType;
  if (body.title !== undefined) data.title = body.title;
  if (body.symptoms !== undefined) data.symptoms = body.symptoms;
  if (body.diagnosis !== undefined) data.diagnosis = body.diagnosis;
  if (body.diseaseName !== undefined) data.diseaseName = body.diseaseName;
  if (body.treatmentRefId !== undefined) data.treatmentRefId = body.treatmentRefId;
  if (body.vaccineRefId !== undefined) data.vaccineRefId = body.vaccineRefId;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.recordedDate !== undefined) data.recordedDate = parseDateOnly(body.recordedDate);

  const row = await prisma.healthEvent.update({ where: { id }, data, include });
  return toHealthEventJsonDto(row);
}

export async function deleteHealthForCustomer(
  customerProfileId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.healthEvent.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return false;
  await prisma.healthEvent.delete({ where: { id } });
  return true;
}
