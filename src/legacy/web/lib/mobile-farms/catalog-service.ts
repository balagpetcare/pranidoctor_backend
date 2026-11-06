import type { FarmTypeConfig } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type FarmSubTypeDto = {
  code: string;
  labelBn: string;
  labelEn: string;
  hintBn: string | null;
  hintEn: string | null;
};

export type FarmTypeDto = {
  code: string;
  labelBn: string;
  labelEn: string;
  unit: "ANIMAL" | "FLOCK";
  subTypes: FarmSubTypeDto[];
};

function unitOf(v: string): "ANIMAL" | "FLOCK" {
  return v === "FLOCK" ? "FLOCK" : "ANIMAL";
}

function nest(rows: FarmTypeConfig[]): FarmTypeDto[] {
  const byParent = new Map<string, FarmTypeConfig[]>();
  for (const r of rows) {
    if (!r.parentCode) continue;
    const list = byParent.get(r.parentCode) ?? [];
    list.push(r);
    byParent.set(r.parentCode, list);
  }
  return rows
    .filter((r) => !r.parentCode)
    .map((r) => ({
      code: r.code,
      labelBn: r.labelBn,
      labelEn: r.labelEn,
      unit: unitOf(r.unit),
      subTypes: (byParent.get(r.code) ?? []).map((c) => ({
        code: c.code,
        labelBn: c.labelBn,
        labelEn: c.labelEn,
        hintBn: c.hintBn,
        hintEn: c.hintEn,
      })),
    }));
}

/** Active catalog for the mobile app, ordered by sortOrder. */
export async function listActiveFarmCatalog(): Promise<FarmTypeDto[]> {
  const rows = await prisma.farmTypeConfig.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return nest(rows);
}

export type FarmKindLabels = {
  type: { code: string; labelBn: string; labelEn: string; unit: "ANIMAL" | "FLOCK" };
  subType: { code: string; labelBn: string; labelEn: string } | null;
};

/** Labels for any code, including inactive ones (existing farms keep their labels). */
export async function loadFarmKindLabels(
  codes: string[],
): Promise<Map<string, FarmTypeConfig>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.farmTypeConfig.findMany({ where: { code: { in: unique } } });
  return new Map(rows.map((r) => [r.code, r]));
}

/** Throws INVALID_FARM_TYPE / SUB_TYPE_REQUIRED / INVALID_SUB_TYPE. */
export async function assertValidFarmSelection(
  type: string,
  subType: string | null | undefined,
): Promise<void> {
  const typeRow = await prisma.farmTypeConfig.findFirst({
    where: { code: type, parentCode: null, isActive: true },
  });
  if (!typeRow) throw new Error("INVALID_FARM_TYPE");
  const subs = await prisma.farmTypeConfig.findMany({
    where: { parentCode: type, isActive: true },
    select: { code: true },
  });
  if (subs.length > 0 && !subType) throw new Error("SUB_TYPE_REQUIRED");
  if (subType && !subs.some((s) => s.code === subType)) {
    throw new Error("INVALID_SUB_TYPE");
  }
}
