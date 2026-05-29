import { prisma } from '@/lib/prisma.js';

import { decimalToNumber } from '../../../../modules/phase4-shared/decimal.js';

export type PlatformFeedAnalytics = {
  periodDays: number;
  feedItems: {
    total: number;
    active: number;
    withNutrition: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  inventory: {
    totalRows: number;
    lowStockCount: number;
    totalQuantityKg: number;
  };
  consumption: {
    totalRecords: number;
    totalCostBdt: number;
    byDay: Array<{ date: string; count: number; costBdt: number }>;
  };
  purchases: {
    totalRecords: number;
    totalCostBdt: number;
  };
  recommendations: {
    totalLogs: number;
    lastSevenDays: number;
  };
};

export async function adminGetPlatformFeedAnalytics(periodDays = 30): Promise<PlatformFeedAnalytics> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - periodDays);
  since.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const [
    feedItemTotal,
    feedItemActive,
    feedItemsWithNutrition,
    categoryGroups,
    inventoryRows,
    consumptionAgg,
    consumptionByDay,
    purchaseAgg,
    recommendationTotal,
    recommendationRecent,
  ] = await Promise.all([
    prisma.feedItem.count(),
    prisma.feedItem.count({ where: { isActive: true } }),
    prisma.feedItem.count({ where: { nutrition: { isNot: null } } }),
    prisma.feedItem.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: { isActive: true },
    }),
    prisma.feedInventory.findMany({
      where: { deletedAt: null, isActive: true },
      select: { quantityOnHand: true, lowStockThreshold: true },
    }),
    prisma.feedConsumption.aggregate({
      where: { recordedDate: { gte: since } },
      _count: { id: true },
      _sum: { costBdt: true },
    }),
    prisma.feedConsumption.groupBy({
      by: ['recordedDate'],
      where: { recordedDate: { gte: since } },
      _count: { _all: true },
      _sum: { costBdt: true },
      orderBy: { recordedDate: 'asc' },
    }),
    prisma.feedPurchase.aggregate({
      where: { purchasedAt: { gte: since } },
      _count: { id: true },
      _sum: { totalCostBdt: true },
    }),
    prisma.feedRecommendationLog.count(),
    prisma.feedRecommendationLog.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const lowStockCount = inventoryRows.filter((row) => {
    if (row.lowStockThreshold == null) return false;
    return row.quantityOnHand.lessThan(row.lowStockThreshold);
  }).length;

  const totalQuantityKg = inventoryRows.reduce(
    (sum, row) => sum + (decimalToNumber(row.quantityOnHand) ?? 0),
    0,
  );

  return {
    periodDays,
    feedItems: {
      total: feedItemTotal,
      active: feedItemActive,
      withNutrition: feedItemsWithNutrition,
      byCategory: categoryGroups.map((g) => ({
        category: g.category,
        count: g._count._all,
      })),
    },
    inventory: {
      totalRows: inventoryRows.length,
      lowStockCount,
      totalQuantityKg,
    },
    consumption: {
      totalRecords: consumptionAgg._count?.id ?? 0,
      totalCostBdt: decimalToNumber(consumptionAgg._sum.costBdt) ?? 0,
      byDay: consumptionByDay.map((row) => ({
        date: row.recordedDate.toISOString().slice(0, 10),
        count: row._count._all,
        costBdt: decimalToNumber(row._sum.costBdt) ?? 0,
      })),
    },
    purchases: {
      totalRecords: purchaseAgg._count?.id ?? 0,
      totalCostBdt: decimalToNumber(purchaseAgg._sum?.totalCostBdt) ?? 0,
    },
    recommendations: {
      totalLogs: recommendationTotal,
      lastSevenDays: recommendationRecent,
    },
  };
}
