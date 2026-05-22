import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  computeVaccineStatus,
  parseDateOnly,
  startOfDayUtc,
  toVaccineRecordJsonDto,
  type VaccineRecordJsonDto,
} from "./vaccine-mapper";
import type { CreateVaccineBody, ListVaccineQuery, PatchVaccineBody } from "./schemas";

const include = { animal: { select: { name: true } } } as const;

async function refreshStatus(row: { id: string; scheduledDate: Date; administeredDate: Date | null; nextDueDate: Date | null }) {
  const status = computeVaccineStatus(row.scheduledDate, row.administeredDate, row.nextDueDate);
  await prisma.vaccineRecord.update({ where: { id: row.id }, data: { status } });
  return status;
}

export async function listVaccinesForCustomer(
  customerProfileId: string,
  query: ListVaccineQuery,
): Promise<{ records: VaccineRecordJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const where: Prisma.VaccineRecordWhereInput = {
    customerId: customerProfileId,
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.vaccineRecord.count({ where }),
    prisma.vaccineRecord.findMany({
      where,
      include,
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  const records: VaccineRecordJsonDto[] = [];
  for (const row of rows) {
    const status = await refreshStatus(row);
    records.push(toVaccineRecordJsonDto({ ...row, status }));
  }

  return {
    records,
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function remindersForCustomer(customerProfileId: string) {
  const rows = await prisma.vaccineRecord.findMany({
    where: { customerId: customerProfileId, administeredDate: null },
    include,
    orderBy: [{ scheduledDate: "asc" }],
  });

  const today = startOfDayUtc(new Date());
  const overdue: VaccineRecordJsonDto[] = [];
  const upcoming: VaccineRecordJsonDto[] = [];

  for (const row of rows) {
    const status = await refreshStatus(row);
    const dto = toVaccineRecordJsonDto({ ...row, status });
    if (status === "OVERDUE") overdue.push(dto);
    else if (status === "DUE" || status === "SCHEDULED") upcoming.push(dto);
  }

  const nextDue = upcoming[0] ?? overdue[0] ?? null;

  return {
    overdue,
    upcoming,
    nextDue,
    pushReminderHook: {
      note: "Push reminders use existing FCM device registration; schedule local fallback on client.",
      endpoint: "/api/mobile/devices/register",
    },
  };
}

export async function createVaccineForCustomer(
  customerProfileId: string,
  body: CreateVaccineBody,
): Promise<VaccineRecordJsonDto> {
  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const scheduledDate = parseDateOnly(body.scheduledDate);
  const administeredDate = body.administeredDate ? parseDateOnly(body.administeredDate) : null;
  const nextDueDate = body.nextDueDate ? parseDateOnly(body.nextDueDate) : null;
  const status = computeVaccineStatus(scheduledDate, administeredDate, nextDueDate);

  const row = await prisma.vaccineRecord.create({
    data: {
      customerId: customerProfileId,
      animalId: body.animalId,
      farmRef: body.farmRef?.trim() || undefined,
      vaccineName: body.vaccineName.trim(),
      vaccineType: body.vaccineType?.trim() || undefined,
      scheduledDate,
      administeredDate: administeredDate ?? undefined,
      nextDueDate: nextDueDate ?? undefined,
      status,
      batchNumber: body.batchNumber?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    },
    include,
  });
  return toVaccineRecordJsonDto(row);
}

export async function getVaccineForCustomer(
  customerProfileId: string,
  id: string,
): Promise<VaccineRecordJsonDto | null> {
  const row = await prisma.vaccineRecord.findFirst({
    where: { id, customerId: customerProfileId },
    include,
  });
  if (!row) return null;
  const status = await refreshStatus(row);
  return toVaccineRecordJsonDto({ ...row, status });
}

export async function patchVaccineForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchVaccineBody,
): Promise<VaccineRecordJsonDto | null> {
  const existing = await prisma.vaccineRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return null;

  const data: Prisma.VaccineRecordUpdateInput = {};
  if (body.animalId !== undefined) data.animal = body.animalId ? { connect: { id: body.animalId } } : { disconnect: true };
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.vaccineName !== undefined) data.vaccineName = body.vaccineName;
  if (body.vaccineType !== undefined) data.vaccineType = body.vaccineType;
  if (body.scheduledDate !== undefined) data.scheduledDate = parseDateOnly(body.scheduledDate);
  if (body.administeredDate !== undefined) {
    data.administeredDate = body.administeredDate ? parseDateOnly(body.administeredDate) : null;
  }
  if (body.nextDueDate !== undefined) {
    data.nextDueDate = body.nextDueDate ? parseDateOnly(body.nextDueDate) : null;
  }
  if (body.batchNumber !== undefined) data.batchNumber = body.batchNumber;
  if (body.notes !== undefined) data.notes = body.notes;

  let row = await prisma.vaccineRecord.update({ where: { id }, data, include });
  const status = body.status ?? computeVaccineStatus(row.scheduledDate, row.administeredDate, row.nextDueDate);
  row = await prisma.vaccineRecord.update({ where: { id }, data: { status }, include });
  return toVaccineRecordJsonDto(row);
}

export async function deleteVaccineForCustomer(
  customerProfileId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.vaccineRecord.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return false;
  await prisma.vaccineRecord.delete({ where: { id } });
  return true;
}
