import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import { decimalToNumber } from '../../../../modules/phase4-shared/decimal.js';

export type AdminInventoryRow = {
  id: string;
  customerId: string;
  farmRef: string;
  displayName: string;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  feedItemCode: string | null;
  feedItemNameBn: string | null;
  updatedAt: string;
};

export type AdminInventoryListResult = {
  items: AdminInventoryRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  summary: {
    totalRows: number;
    lowStockCount: number;
    totalQuantityKg: number;
  };
};

function isLowStock(
  quantityOnHand: Prisma.Decimal,
  threshold: Prisma.Decimal | null,
): boolean {
  if (threshold == null) return false;
  return quantityOnHand.lessThan(threshold);
}

export async function adminListFeedInventory(params: {
  page: number;
  limit: number;
  search?: string;
  lowStockOnly?: boolean;
  farmRef?: string;
}): Promise<AdminInventoryListResult> {
  const where: Prisma.FeedInventoryWhereInput = {
    deletedAt: null,
    isActive: true,
    ...(params.farmRef ? { farmRef: params.farmRef } : {}),
    ...(params.search?.trim()
      ? {
          OR: [
            { displayName: { contains: params.search.trim(), mode: 'insensitive' } },
            { farmRef: { contains: params.search.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const skip = (params.page - 1) * params.limit;

  if (params.lowStockOnly) {
    const lowStockWhere: Prisma.FeedInventoryWhereInput = {
      ...where,
      lowStockThreshold: { not: null },
    };

    const [allLowStockRows, allForSummary] = await Promise.all([
      prisma.feedInventory.findMany({
        where: lowStockWhere,
        include: {
          feedItem: { select: { code: true, nameBn: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
      }),
      prisma.feedInventory.findMany({
        where,
        select: { quantityOnHand: true, lowStockThreshold: true },
      }),
    ]);

    const filtered = allLowStockRows.filter((row) =>
      isLowStock(row.quantityOnHand, row.lowStockThreshold),
    );
    const total = filtered.length;
    const pageRows = filtered.slice(skip, skip + params.limit);

    const lowStockCount = allForSummary.filter((row) =>
      isLowStock(row.quantityOnHand, row.lowStockThreshold),
    ).length;

    const totalQuantityKg = allForSummary.reduce(
      (sum, row) => sum + (decimalToNumber(row.quantityOnHand) ?? 0),
      0,
    );

    const mapped = pageRows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      farmRef: row.farmRef,
      displayName: row.displayName,
      unit: row.unit,
      quantityOnHand: decimalToNumber(row.quantityOnHand) ?? 0,
      lowStockThreshold: decimalToNumber(row.lowStockThreshold),
      isLowStock: true,
      feedItemCode: row.feedItem?.code ?? null,
      feedItemNameBn: row.feedItem?.nameBn ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));

    return {
      items: mapped,
      page: params.page,
      limit: params.limit,
      total,
      hasMore: params.page * params.limit < total,
      summary: {
        totalRows: allForSummary.length,
        lowStockCount,
        totalQuantityKg,
      },
    };
  }

  const [total, rows, allForSummary] = await Promise.all([
    prisma.feedInventory.count({ where }),
    prisma.feedInventory.findMany({
      where,
      include: {
        feedItem: { select: { code: true, nameBn: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: params.limit,
    }),
    prisma.feedInventory.findMany({
      where,
      select: { quantityOnHand: true, lowStockThreshold: true },
    }),
  ]);

  const lowStockCount = allForSummary.filter((row) =>
    isLowStock(row.quantityOnHand, row.lowStockThreshold),
  ).length;

  const totalQuantityKg = allForSummary.reduce(
    (sum, row) => sum + (decimalToNumber(row.quantityOnHand) ?? 0),
    0,
  );

  let mapped = rows.map((row) => ({
    id: row.id,
    customerId: row.customerId,
    farmRef: row.farmRef,
    displayName: row.displayName,
    unit: row.unit,
    quantityOnHand: decimalToNumber(row.quantityOnHand) ?? 0,
    lowStockThreshold: decimalToNumber(row.lowStockThreshold),
    isLowStock: isLowStock(row.quantityOnHand, row.lowStockThreshold),
    feedItemCode: row.feedItem?.code ?? null,
    feedItemNameBn: row.feedItem?.nameBn ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return {
    items: mapped,
    page: params.page,
    limit: params.limit,
    total,
    hasMore: params.page * params.limit < total,
    summary: {
      totalRows: total,
      lowStockCount,
      totalQuantityKg,
    },
  };
}
