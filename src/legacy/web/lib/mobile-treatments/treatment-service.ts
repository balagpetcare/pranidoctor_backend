import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  parseDateOnly,
  toFarmTreatmentJsonDto,
  type FarmTreatmentJsonDto,
} from "./treatment-mapper";
import type { CreateTreatmentBody, ListTreatmentQuery, PatchTreatmentBody } from "./schemas";

const include = { animal: { select: { name: true } } } as const;

export async function listTreatmentsForCustomer(
  customerProfileId: string,
  query: ListTreatmentQuery,
): Promise<{ records: FarmTreatmentJsonDto[]; total: number; page: number; limit: number; hasMore: boolean }> {
  const where: Prisma.FarmTreatmentWhereInput = {
    customerId: customerProfileId,
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { diagnosis: { contains: query.search, mode: "insensitive" } },
            { prescription: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.farmTreatment.count({ where }),
    prisma.farmTreatment.findMany({
      where,
      include,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    records: rows.map(toFarmTreatmentJsonDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function createTreatmentForCustomer(
  customerProfileId: string,
  body: CreateTreatmentBody,
): Promise<FarmTreatmentJsonDto> {
  if (body.animalId) {
    const animal = await prisma.animalProfile.findFirst({
      where: { id: body.animalId, customerId: customerProfileId, active: true },
    });
    if (!animal) throw new Error("ANIMAL_NOT_FOUND");
  }

  const row = await prisma.farmTreatment.create({
    data: {
      customerId: customerProfileId,
      animalId: body.animalId,
      farmRef: body.farmRef?.trim() || undefined,
      title: body.title.trim(),
      diagnosis: body.diagnosis?.trim() || undefined,
      prescription: body.prescription?.trim() || undefined,
      medicinesJson: body.medicines ?? [],
      startDate: parseDateOnly(body.startDate),
      endDate: body.endDate ? parseDateOnly(body.endDate) : undefined,
      status: body.status ?? "ACTIVE",
      notes: body.notes?.trim() || undefined,
    },
    include,
  });
  return toFarmTreatmentJsonDto(row);
}

export async function getTreatmentForCustomer(
  customerProfileId: string,
  id: string,
): Promise<FarmTreatmentJsonDto | null> {
  const row = await prisma.farmTreatment.findFirst({
    where: { id, customerId: customerProfileId },
    include,
  });
  return row ? toFarmTreatmentJsonDto(row) : null;
}

export async function patchTreatmentForCustomer(
  customerProfileId: string,
  id: string,
  body: PatchTreatmentBody,
): Promise<FarmTreatmentJsonDto | null> {
  const existing = await prisma.farmTreatment.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return null;

  const data: Prisma.FarmTreatmentUpdateInput = {};
  if (body.animalId !== undefined) data.animal = body.animalId ? { connect: { id: body.animalId } } : { disconnect: true };
  if (body.farmRef !== undefined) data.farmRef = body.farmRef;
  if (body.title !== undefined) data.title = body.title;
  if (body.diagnosis !== undefined) data.diagnosis = body.diagnosis;
  if (body.prescription !== undefined) data.prescription = body.prescription;
  if (body.medicines !== undefined) data.medicinesJson = body.medicines;
  if (body.startDate !== undefined) data.startDate = parseDateOnly(body.startDate);
  if (body.endDate !== undefined) data.endDate = body.endDate ? parseDateOnly(body.endDate) : null;
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;

  const row = await prisma.farmTreatment.update({ where: { id }, data, include });
  return toFarmTreatmentJsonDto(row);
}

export async function deleteTreatmentForCustomer(
  customerProfileId: string,
  id: string,
): Promise<boolean> {
  const existing = await prisma.farmTreatment.findFirst({
    where: { id, customerId: customerProfileId },
  });
  if (!existing) return false;
  await prisma.farmTreatment.delete({ where: { id } });
  return true;
}
