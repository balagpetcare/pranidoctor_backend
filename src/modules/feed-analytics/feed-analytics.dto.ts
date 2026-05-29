import type { LivestockSpecies } from '@/generated/prisma/client';

export type AnalyticsPeriodDto = {
  from: string;
  to: string;
};

export type DashboardDto = {
  farmRef: string;
  period: AnalyticsPeriodDto;
  animalCount: {
    total: number;
    active: number;
    bySpecies: Partial<Record<LivestockSpecies, number>>;
  };
  feedCostBdt: number;
  livestockExpenseBdt: number;
  totalExpenseBdt: number;
  lowStockCount: number;
};

export type FeedEfficiencyDto = {
  farmRef: string;
  period: AnalyticsPeriodDto;
  totalFeedKg: number;
  totalFeedCostBdt: number;
  activeLivestockCount: number;
  costPerLivestockBdt: number | null;
  avgFeedKgPerLivestock: number | null;
};

export type ProfitLossDto = {
  farmRef: string;
  period: AnalyticsPeriodDto;
  livestockExpenseBdt: number;
  feedConsumptionCostBdt: number;
  totalExpenseBdt: number;
  breakdownByCategory: Array<{ category: string; amountBdt: number }>;
};

export type FeedAnalyticsCacheDto = {
  id: string;
  customerId: string;
  farmRef: string;
  cacheKey: string;
  periodStart: string;
  periodEnd: string;
  metrics: DashboardDto;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};
