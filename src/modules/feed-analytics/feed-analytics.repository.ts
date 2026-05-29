import type { Prisma } from '@/generated/prisma/client';
import { FeedUnit, LivestockLifecycleStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

function parseBusinessDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export class FeedAnalyticsRepository {
  async countLivestock(customerId: string, farmRef: string) {
    const rows = await prisma.livestock.groupBy({
      by: ['species', 'lifecycleStatus'],
      where: { customerId, farmRef, deletedAt: null },
      _count: { _all: true },
    });
    return rows;
  }

  async sumFeedConsumptionCost(
    customerId: string,
    farmRef: string,
    from: Date,
    to: Date,
  ) {
    const agg = await prisma.feedConsumption.aggregate({
      where: {
        customerId,
        farmRef,
        recordedDate: { gte: from, lte: to },
      },
      _sum: { costBdt: true, amount: true },
    });
    return agg;
  }

  async listFeedConsumptions(
    customerId: string,
    farmRef: string,
    from: Date,
    to: Date,
  ) {
    return prisma.feedConsumption.findMany({
      where: {
        customerId,
        farmRef,
        recordedDate: { gte: from, lte: to },
      },
      select: {
        amount: true,
        unit: true,
        costBdt: true,
        feedInventory: {
          select: { defaultBagWeightKg: true },
        },
      },
    });
  }

  async sumFeedPurchaseCost(
    customerId: string,
    farmRef: string,
    from: Date,
    to: Date,
  ) {
    return prisma.feedPurchase.aggregate({
      where: {
        customerId,
        farmRef,
        purchasedAt: { gte: from, lte: to },
      },
      _sum: { totalCostBdt: true },
    });
  }

  async sumLivestockExpenses(
    customerId: string,
    farmRef: string,
    from: Date,
    to: Date,
  ) {
    const [totalAgg, byCategory] = await Promise.all([
      prisma.livestockExpense.aggregate({
        where: {
          customerId,
          farmRef,
          recordedDate: { gte: from, lte: to },
        },
        _sum: { amountBdt: true },
      }),
      prisma.livestockExpense.groupBy({
        by: ['category'],
        where: {
          customerId,
          farmRef,
          recordedDate: { gte: from, lte: to },
        },
        _sum: { amountBdt: true },
      }),
    ]);

    return { totalAgg, byCategory };
  }

  async countLowStockFeedInventory(customerId: string, farmRef: string) {
    const rows = await prisma.feedInventory.findMany({
      where: {
        customerId,
        farmRef,
        deletedAt: null,
        isActive: true,
        lowStockThreshold: { not: null },
      },
      select: {
        quantityOnHand: true,
        lowStockThreshold: true,
      },
    });

    return rows.filter((row) => {
      const onHand = Number(row.quantityOnHand);
      const threshold = row.lowStockThreshold != null ? Number(row.lowStockThreshold) : null;
      return threshold != null && onHand <= threshold;
    }).length;
  }

  async countActiveLivestock(customerId: string, farmRef: string) {
    return prisma.livestock.count({
      where: {
        customerId,
        farmRef,
        deletedAt: null,
        lifecycleStatus: LivestockLifecycleStatus.ACTIVE,
      },
    });
  }

  async upsertAnalyticsCache(params: {
    customerId: string;
    farmRef: string;
    cacheKey: string;
    periodStart: Date;
    periodEnd: Date;
    metricsJson: Prisma.InputJsonValue;
    expiresAt: Date;
  }) {
    return prisma.feedAnalyticsCache.upsert({
      where: {
        customerId_farmRef_cacheKey: {
          customerId: params.customerId,
          farmRef: params.farmRef,
          cacheKey: params.cacheKey,
        },
      },
      create: {
        customerId: params.customerId,
        farmRef: params.farmRef,
        cacheKey: params.cacheKey,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        metricsJson: params.metricsJson,
        expiresAt: params.expiresAt,
      },
      update: {
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        metricsJson: params.metricsJson,
        expiresAt: params.expiresAt,
      },
    });
  }
}

let repositorySingleton: FeedAnalyticsRepository | undefined;

export function getFeedAnalyticsRepository(): FeedAnalyticsRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FeedAnalyticsRepository();
  }
  return repositorySingleton;
}

export function consumptionAmountToKg(
  amount: Prisma.Decimal,
  unit: FeedUnit,
  bagWeightKg?: Prisma.Decimal | null,
): number {
  const value = Number(amount);
  switch (unit) {
    case FeedUnit.KG:
      return value;
    case FeedUnit.BAG: {
      const bagWeight = bagWeightKg != null ? Number(bagWeightKg) : 40;
      return value * bagWeight;
    }
    default:
      return 0;
  }
}

export { parseBusinessDate };
