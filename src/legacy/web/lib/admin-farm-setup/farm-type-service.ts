import { prisma } from "@/lib/prisma";

import type {
  CreateFarmTypeConfigBody,
  PatchFarmTypeConfigBody,
} from "../mobile-farms/schemas";

export type AdminFarmTypeRow = {
  id: string;
  code: string;
  parentCode: string | null;
  labelBn: string;
  labelEn: string;
  hintBn: string | null;
  hintEn: string | null;
  unit: string;
  sortOrder: number;
  isActive: boolean;
  farmCount: number;
};

async function withCounts(
  rows: Awaited<ReturnType<typeof prisma.farmTypeConfig.findMany>>,
): Promise<AdminFarmTypeRow[]> {
  const [byType, bySub] = await Promise.all([
    prisma.farm.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.farm.groupBy({ by: ["subType"], _count: { _all: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const g of byType) counts.set(g.type, g._count._all);
  for (const g of bySub) if (g.subType) counts.set(g.subType, g._count._all);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    parentCode: r.parentCode,
    labelBn: r.labelBn,
    labelEn: r.labelEn,
    hintBn: r.hintBn,
    hintEn: r.hintEn,
    unit: r.unit,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    farmCount: counts.get(r.code) ?? 0,
  }));
}

export async function adminListFarmTypes(): Promise<AdminFarmTypeRow[]> {
  const rows = await prisma.farmTypeConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return withCounts(rows);
}

export async function adminGetFarmType(id: string): Promise<AdminFarmTypeRow | null> {
  const row = await prisma.farmTypeConfig.findUnique({ where: { id } });
  if (!row) return null;
  return (await withCounts([row]))[0] ?? null;
}

export async function adminCreateFarmType(
  body: CreateFarmTypeConfigBody,
): Promise<AdminFarmTypeRow> {
  const exists = await prisma.farmTypeConfig.findUnique({ where: { code: body.code } });
  if (exists) throw new Error("CODE_TAKEN");

  let unit: string = body.unit;
  if (body.parentCode) {
    const parent = await prisma.farmTypeConfig.findFirst({
      where: { code: body.parentCode, parentCode: null },
    });
    if (!parent) throw new Error("PARENT_NOT_FOUND");
    unit = parent.unit;
  }

  const row = await prisma.farmTypeConfig.create({
    data: {
      id: `farmtype-${body.code}`,
      code: body.code,
      parentCode: body.parentCode ?? null,
      labelBn: body.labelBn,
      labelEn: body.labelEn,
      hintBn: body.hintBn ?? null,
      hintEn: body.hintEn ?? null,
      unit,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    },
  });
  return (await withCounts([row]))[0]!;
}

export async function adminPatchFarmType(
  id: string,
  body: PatchFarmTypeConfigBody,
): Promise<AdminFarmTypeRow | null> {
  const existing = await prisma.farmTypeConfig.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.farmTypeConfig.update({
    where: { id },
    data: {
      ...(body.labelBn !== undefined ? { labelBn: body.labelBn } : {}),
      ...(body.labelEn !== undefined ? { labelEn: body.labelEn } : {}),
      ...(body.hintBn !== undefined ? { hintBn: body.hintBn } : {}),
      ...(body.hintEn !== undefined ? { hintEn: body.hintEn } : {}),
      // Sub types always follow their parent's unit.
      ...(body.unit !== undefined && !existing.parentCode ? { unit: body.unit } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });
  if (body.unit !== undefined && !existing.parentCode) {
    await prisma.farmTypeConfig.updateMany({
      where: { parentCode: existing.code },
      data: { unit: body.unit },
    });
  }
  return (await withCounts([row]))[0]!;
}
