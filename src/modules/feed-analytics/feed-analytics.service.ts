import type { LivestockSpecies } from '@/generated/prisma/client';
import { LivestockLifecycleStatus } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import type {
  DashboardDto,
  FeedAnalyticsCacheDto,
  FeedEfficiencyDto,
  ProfitLossDto,
} from './feed-analytics.dto.js';
import { sumDecimal, toFeedAnalyticsCacheDto } from './feed-analytics.mapper.js';
import {
  consumptionAmountToKg,
  getFeedAnalyticsRepository,
  parseBusinessDate,
} from './feed-analytics.repository.js';

const DASHBOARD_CACHE_KEY = 'dashboard';
const CACHE_TTL_MS = 60 * 60 * 1000;

export class FeedAnalyticsService {
  constructor(private readonly repo = getFeedAnalyticsRepository()) {}

  async getDashboard(
    customerId: string,
    farmRef: string,
    from: string,
    to: string,
  ): Promise<DashboardDto> {
    const periodStart = parseBusinessDate(from);
    const periodEnd = parseBusinessDate(to);

    const [
      livestockGroups,
      consumptionAgg,
      purchaseAgg,
      expenseAgg,
      lowStockCount,
    ] = await Promise.all([
      this.repo.countLivestock(customerId, farmRef),
      this.repo.sumFeedConsumptionCost(customerId, farmRef, periodStart, periodEnd),
      this.repo.sumFeedPurchaseCost(customerId, farmRef, periodStart, periodEnd),
      this.repo.sumLivestockExpenses(customerId, farmRef, periodStart, periodEnd),
      this.repo.countLowStockFeedInventory(customerId, farmRef),
    ]);

    let total = 0;
    let active = 0;
    const bySpecies: Partial<Record<LivestockSpecies, number>> = {};

    for (const row of livestockGroups) {
      total += row._count._all;
      if (row.lifecycleStatus === LivestockLifecycleStatus.ACTIVE) {
        active += row._count._all;
        bySpecies[row.species] = (bySpecies[row.species] ?? 0) + row._count._all;
      }
    }

    const feedConsumptionCost = decimalToNumber(consumptionAgg._sum.costBdt) ?? 0;
    const feedPurchaseCost = decimalToNumber(purchaseAgg._sum.totalCostBdt) ?? 0;
    const feedCostBdt = feedConsumptionCost + feedPurchaseCost;
    const livestockExpenseBdt = decimalToNumber(expenseAgg.totalAgg._sum.amountBdt) ?? 0;

    return {
      farmRef,
      period: { from, to },
      animalCount: { total, active, bySpecies },
      feedCostBdt,
      livestockExpenseBdt,
      totalExpenseBdt: feedCostBdt + livestockExpenseBdt,
      lowStockCount,
    };
  }

  async getFeedEfficiency(
    customerId: string,
    farmRef: string,
    from: string,
    to: string,
  ): Promise<FeedEfficiencyDto> {
    const periodStart = parseBusinessDate(from);
    const periodEnd = parseBusinessDate(to);

    const [consumptions, activeLivestockCount] = await Promise.all([
      this.repo.listFeedConsumptions(customerId, farmRef, periodStart, periodEnd),
      this.repo.countActiveLivestock(customerId, farmRef),
    ]);

    let totalFeedKg = 0;
    for (const row of consumptions) {
      totalFeedKg += consumptionAmountToKg(
        row.amount,
        row.unit,
        row.feedInventory?.defaultBagWeightKg,
      );
    }

    const totalFeedCostBdt = sumDecimal(consumptions.map((row) => row.costBdt));
    const costPerLivestockBdt =
      activeLivestockCount > 0 ? totalFeedCostBdt / activeLivestockCount : null;
    const avgFeedKgPerLivestock =
      activeLivestockCount > 0 ? totalFeedKg / activeLivestockCount : null;

    return {
      farmRef,
      period: { from, to },
      totalFeedKg: Math.round(totalFeedKg * 1000) / 1000,
      totalFeedCostBdt: Math.round(totalFeedCostBdt * 100) / 100,
      activeLivestockCount,
      costPerLivestockBdt:
        costPerLivestockBdt != null ? Math.round(costPerLivestockBdt * 100) / 100 : null,
      avgFeedKgPerLivestock:
        avgFeedKgPerLivestock != null
          ? Math.round(avgFeedKgPerLivestock * 1000) / 1000
          : null,
    };
  }

  async getProfitLoss(
    customerId: string,
    farmRef: string,
    from: string,
    to: string,
  ): Promise<ProfitLossDto> {
    const periodStart = parseBusinessDate(from);
    const periodEnd = parseBusinessDate(to);

    const [expenseAgg, consumptionAgg] = await Promise.all([
      this.repo.sumLivestockExpenses(customerId, farmRef, periodStart, periodEnd),
      this.repo.sumFeedConsumptionCost(customerId, farmRef, periodStart, periodEnd),
    ]);

    const livestockExpenseBdt = decimalToNumber(expenseAgg.totalAgg._sum.amountBdt) ?? 0;
    const feedConsumptionCostBdt = decimalToNumber(consumptionAgg._sum.costBdt) ?? 0;
    const totalExpenseBdt = livestockExpenseBdt + feedConsumptionCostBdt;

    const breakdownByCategory: ProfitLossDto['breakdownByCategory'] = expenseAgg.byCategory.map(
      (row) => ({
        category: row.category,
        amountBdt: decimalToNumber(row._sum.amountBdt) ?? 0,
      }),
    );

    if (feedConsumptionCostBdt > 0) {
      breakdownByCategory.push({
        category: 'FEED_CONSUMPTION',
        amountBdt: feedConsumptionCostBdt,
      });
    }

    return {
      farmRef,
      period: { from, to },
      livestockExpenseBdt,
      feedConsumptionCostBdt,
      totalExpenseBdt,
      breakdownByCategory,
    };
  }

  async cacheDashboard(
    customerId: string,
    farmRef: string,
    from: string,
    to: string,
  ): Promise<FeedAnalyticsCacheDto> {
    const metrics = await this.getDashboard(customerId, farmRef, from, to);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    const row = await this.repo.upsertAnalyticsCache({
      customerId,
      farmRef,
      cacheKey: DASHBOARD_CACHE_KEY,
      periodStart: parseBusinessDate(from),
      periodEnd: parseBusinessDate(to),
      metricsJson: metrics,
      expiresAt,
    });

    return toFeedAnalyticsCacheDto(row);
  }
}

let serviceSingleton: FeedAnalyticsService | undefined;

export function getFeedAnalyticsService(): FeedAnalyticsService {
  if (!serviceSingleton) {
    serviceSingleton = new FeedAnalyticsService();
  }
  return serviceSingleton;
}
