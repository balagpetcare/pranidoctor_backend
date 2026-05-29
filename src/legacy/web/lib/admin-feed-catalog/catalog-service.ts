import { FeedCategory, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma.js";

import type { CreateFeedCatalogBody, PatchFeedCatalogBody } from "./schemas.js";

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value == null) return null;
  return Number(value);
}

function serializeRow(row: {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  category: FeedCategory;
  defaultUnit: string;
  approxPriceBdt: Prisma.Decimal | null;
  nutritionJson: Prisma.JsonValue;
  availabilityScore: number | null;
  isSeeded: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    category: row.category,
    defaultUnit: row.defaultUnit,
    approxPriceBdt: decimalToNumber(row.approxPriceBdt),
    nutritionJson: row.nutritionJson,
    availabilityScore: row.availabilityScore,
    isSeeded: row.isSeeded,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminListFeedCatalog(params: {
  q?: string;
  category?: FeedCategory;
  isActive?: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.FeedCatalogWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.category) where.category = params.category;
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameBn: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.feedCatalog.count({ where }),
    prisma.feedCatalog.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { nameBn: "asc" }],
      take: params.limit,
      skip: params.offset,
    }),
  ]);
  return { total, items: rows.map(serializeRow) };
}

export async function adminGetFeedCatalog(id: string) {
  const row = await prisma.feedCatalog.findUnique({ where: { id } });
  if (!row) return null;
  return serializeRow(row);
}

export async function adminCreateFeedCatalog(body: CreateFeedCatalogBody) {
  const row = await prisma.feedCatalog.create({
    data: {
      code: body.code.trim().toLowerCase(),
      nameBn: body.nameBn.trim(),
      nameEn: body.nameEn.trim(),
      category: body.category,
      defaultUnit: body.defaultUnit,
      approxPriceBdt:
        body.approxPriceBdt != null
          ? new Prisma.Decimal(body.approxPriceBdt.toFixed(2))
          : null,
      nutritionJson: body.nutritionJson ?? Prisma.JsonNull,
      availabilityScore: body.availabilityScore ?? null,
      isSeeded: false,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return serializeRow(row);
}

export async function adminPatchFeedCatalog(id: string, body: PatchFeedCatalogBody) {
  const existing = await prisma.feedCatalog.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Prisma.FeedCatalogUpdateInput = {};
  if (body.nameBn !== undefined) data.nameBn = body.nameBn.trim();
  if (body.nameEn !== undefined) data.nameEn = body.nameEn.trim();
  if (body.category !== undefined) data.category = body.category;
  if (body.defaultUnit !== undefined) data.defaultUnit = body.defaultUnit;
  if (body.approxPriceBdt !== undefined) {
    data.approxPriceBdt =
      body.approxPriceBdt == null
        ? null
        : new Prisma.Decimal(body.approxPriceBdt.toFixed(2));
  }
  if (body.nutritionJson !== undefined) {
    data.nutritionJson = body.nutritionJson ?? Prisma.JsonNull;
  }
  if (body.availabilityScore !== undefined) data.availabilityScore = body.availabilityScore;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const row = await prisma.feedCatalog.update({ where: { id }, data });
  return serializeRow(row);
}
