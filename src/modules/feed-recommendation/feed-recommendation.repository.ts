import { prisma } from '@/lib/prisma.js';

import { decimalToNumber } from '../phase4-shared/decimal.js';

import type { ActiveFeedItemRow, LivestockIntelligenceContext } from './feed-recommendation.types.js';
import type { RecommendationResult } from './feed-recommendation.types.js';

export class FeedRecommendationRepository {
  async listActiveFeedItems(): Promise<ActiveFeedItemRow[]> {
    const rows = await prisma.feedItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameBn: 'asc' }],
      select: {
        id: true,
        code: true,
        category: true,
        nameBn: true,
        approxPriceBdt: true,
        sortOrder: true,
        isSeasonal: true,
        suitabilityJson: true,
        nutrition: {
          select: {
            cpPercent: true,
            tdnPercent: true,
            dmPercent: true,
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      category: r.category,
      nameBn: r.nameBn,
      approxPriceBdt: decimalToNumber(r.approxPriceBdt),
      sortOrder: r.sortOrder,
      isSeasonal: r.isSeasonal,
      suitabilityJson: r.suitabilityJson,
      nutrition: r.nutrition
        ? {
            cpPercent: decimalToNumber(r.nutrition.cpPercent),
            tdnPercent: decimalToNumber(r.nutrition.tdnPercent),
            dmPercent: decimalToNumber(r.nutrition.dmPercent),
          }
        : null,
    }));
  }

  async getLivestockIntelligenceContext(
    livestockId: string,
  ): Promise<LivestockIntelligenceContext> {
    const livestock = await prisma.livestock.findFirst({
      where: { id: livestockId, deletedAt: null },
      select: {
        lactationNumber: true,
        lastCalvingDate: true,
      },
    });

    const healthRecords = await prisma.livestockHealthRecord.findMany({
      where: { livestockId },
      orderBy: { recordedDate: 'desc' },
      take: 5,
      select: {
        title: true,
        diagnosis: true,
        diseaseName: true,
        symptoms: true,
      },
    });

    const keywords: string[] = [];
    for (const rec of healthRecords) {
      if (rec.diseaseName) keywords.push(rec.diseaseName);
      if (rec.diagnosis) keywords.push(rec.diagnosis);
      if (rec.title) keywords.push(rec.title);
      if (rec.symptoms) keywords.push(rec.symptoms);
    }

    return {
      lactationNumber: livestock?.lactationNumber ?? null,
      lastCalvingDate: livestock?.lastCalvingDate ?? null,
      estimatedDailyMilkLiters: null,
      recentDiseaseKeywords: keywords,
      budgetBdt: null,
    };
  }

  async findLogById(customerId: string, logId: string) {
    return prisma.feedRecommendationLog.findFirst({
      where: { id: logId, customerId },
    });
  }

  async findAcceptedLog(customerId: string, livestockId: string, planDate: Date) {
    return prisma.feedRecommendationLog.findFirst({
      where: {
        customerId,
        livestockId,
        planDate,
        accepted: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLog(params: {
    customerId: string;
    livestockId: string;
    planDate: Date;
    ruleVersion: string;
    result: RecommendationResult;
    accepted: boolean;
  }) {
    return prisma.feedRecommendationLog.create({
      data: {
        customer: { connect: { id: params.customerId } },
        livestock: { connect: { id: params.livestockId } },
        planDate: params.planDate,
        ruleVersion: params.ruleVersion,
        itemsJson: params.result.items,
        totalsJson: params.result.totals,
        warningsJson: params.result.warnings,
        accepted: params.accepted,
      },
    });
  }

  async markAccepted(logId: string) {
    return prisma.feedRecommendationLog.update({
      where: { id: logId },
      data: { accepted: true },
    });
  }
}

let repositorySingleton: FeedRecommendationRepository | undefined;

export function getFeedRecommendationRepository(): FeedRecommendationRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FeedRecommendationRepository();
  }
  return repositorySingleton;
}
