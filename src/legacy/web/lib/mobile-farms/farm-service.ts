import { randomUUID } from "node:crypto";

import type { Farm, FarmTypeConfig, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { assertValidFarmSelection, loadFarmKindLabels } from "./catalog-service";
import type { CreateFarmBody, UpdateFarmBody } from "./schemas";

export type FarmKindDto = {
  code: string;
  labelBn: string;
  labelEn: string;
  isFlock: boolean;
};

export type FarmDto = {
  id: string;
  name: string;
  type: string;
  subType: string | null;
  kind: FarmKindDto;
  subKind: FarmKindDto | null;
  locationLabel: string;
  address: {
    divisionId: string | null;
    districtId: string | null;
    upazilaId: string | null;
    unionId: string | null;
    villageId: string | null;
    villageName: string | null;
    line1: string | null;
  };
  coverPhotoUrl: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

const FALLBACK_OTHER = { labelBn: "অন্যান্য খামার", labelEn: "Other farm" };

export function toFarmDto(f: Farm, labels: Map<string, FarmTypeConfig>): FarmDto {
  const typeRow = labels.get(f.type);
  const subRow = f.subType ? labels.get(f.subType) : undefined;
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    subType: f.subType,
    kind: {
      code: f.type,
      labelBn: typeRow?.labelBn ?? FALLBACK_OTHER.labelBn,
      labelEn: typeRow?.labelEn ?? FALLBACK_OTHER.labelEn,
      isFlock: typeRow?.unit === "FLOCK",
    },
    subKind:
      f.subType && subRow
        ? {
            code: f.subType,
            labelBn: subRow.labelBn,
            labelEn: subRow.labelEn,
            isFlock: typeRow?.unit === "FLOCK",
          }
        : null,
    locationLabel: f.locationLabel ?? f.villageName ?? "",
    address: {
      divisionId: f.divisionId,
      districtId: f.districtId,
      upazilaId: f.upazilaId,
      unionId: f.unionId,
      villageId: f.villageId,
      villageName: f.villageName,
      line1: f.line1,
    },
    coverPhotoUrl: f.coverPhotoUrl,
    active: f.active,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

export async function listFarmsForCustomer(customerId: string): Promise<FarmDto[]> {
  const rows = await prisma.farm.findMany({
    where: { customerId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const labels = await loadFarmKindLabels(
    rows.flatMap((r) => [r.type, r.subType ?? ""]),
  );
  return rows.map((r) => toFarmDto(r, labels));
}

export async function getFarmForCustomer(
  customerId: string,
  id: string,
): Promise<FarmDto> {
  const row = await prisma.farm.findFirst({ where: { id, customerId, active: true } });
  if (!row) throw new Error("FARM_NOT_FOUND");
  return toFarmDto(row, await loadFarmKindLabels([row.type, row.subType ?? ""]));
}

export async function createFarmForCustomer(
  customerId: string,
  body: CreateFarmBody,
): Promise<FarmDto> {
  const id = body.id ?? `farm-${randomUUID()}`;
  if (body.id) {
    const existing = await prisma.farm.findUnique({ where: { id } });
    if (existing) {
      if (existing.customerId !== customerId) throw new Error("FARM_ID_TAKEN");
      return toFarmDto(
        existing,
        await loadFarmKindLabels([existing.type, existing.subType ?? ""]),
      );
    }
  }
  await assertValidFarmSelection(body.type, body.subType);
  const row = await prisma.farm.create({
    data: {
      id,
      customerId,
      name: body.name,
      type: body.type,
      subType: body.subType ?? null,
      divisionId: body.divisionId ?? null,
      districtId: body.districtId ?? null,
      upazilaId: body.upazilaId ?? null,
      unionId: body.unionId ?? null,
      villageId: body.villageId ?? null,
      villageName: body.villageName ?? null,
      line1: body.line1 ?? null,
      locationLabel: body.locationLabel ?? null,
      coverPhotoUrl: body.coverPhotoUrl ?? null,
    },
  });
  return toFarmDto(row, await loadFarmKindLabels([row.type, row.subType ?? ""]));
}

export async function updateFarmForCustomer(
  customerId: string,
  id: string,
  body: UpdateFarmBody,
): Promise<FarmDto> {
  const existing = await prisma.farm.findFirst({ where: { id, customerId, active: true } });
  if (!existing) throw new Error("FARM_NOT_FOUND");

  const data: Prisma.FarmUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.type !== undefined) {
    await assertValidFarmSelection(body.type, body.subType);
    data.type = body.type;
    data.subType = body.subType ?? null;
  } else if (body.subType !== undefined) {
    await assertValidFarmSelection(existing.type, body.subType);
    data.subType = body.subType;
  }
  for (const key of [
    "divisionId",
    "districtId",
    "upazilaId",
    "unionId",
    "villageId",
    "villageName",
    "line1",
    "locationLabel",
  ] as const) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.coverPhotoUrl !== undefined) data.coverPhotoUrl = body.coverPhotoUrl;

  const row = await prisma.farm.update({ where: { id }, data });
  return toFarmDto(row, await loadFarmKindLabels([row.type, row.subType ?? ""]));
}
