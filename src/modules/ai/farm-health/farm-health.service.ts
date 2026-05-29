import { getPrisma } from '../../../shared/database/prisma.js';
import { getRiskScoringService } from '../risk/risk-scoring.service.js';
import { getSmartRecommendationService } from '../recommendations/smart-recommendation.service.js';

export class FarmHealthService {
  readonly name = 'FarmHealthService';

  async getDashboard(customerId: string, farmRef: string, locale: 'bn' | 'en' = 'bn') {
    const prisma = getPrisma();

    const risk = await getRiskScoringService().computeFarmRisk(customerId, farmRef);
    const recommendations = await getSmartRecommendationService().generateForCustomer(
      customerId,
      farmRef,
      locale,
    );

    const livestockCount = await prisma.livestock.count({
      where: { customerId, farmRef, deletedAt: null, lifecycleStatus: 'ACTIVE' },
    });

    const farmLivestockIds = await prisma.livestock.findMany({
      where: { customerId, farmRef, deletedAt: null },
      select: { id: true },
    });
    const livestockIds = farmLivestockIds.map((l) => l.id);

    const recentChecks =
      livestockIds.length === 0
        ? []
        : await prisma.aiSymptomCheckSession.findMany({
            where: { customerId, livestockId: { in: livestockIds } },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

    const followUps = await prisma.aiFollowUpSuggestion.findMany({
      where: {
        customerId,
        dismissed: false,
        OR: [
          { livestockId: { in: livestockIds } },
          { livestockId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      farmRef,
      livestockCount,
      herdHealthScore: risk.herdHealthScore,
      farmRiskScore: risk.farmRiskScore,
      mortalityRiskAvg: risk.mortalityRiskAvg,
      factors: risk.factors,
      recommendations: recommendations.slice(0, 10),
      recentSymptomChecks: recentChecks.map((c) => ({
        id: c.id,
        species: c.species,
        triageBucket: c.triageBucket,
        confidence: c.confidence,
        createdAt: c.createdAt.toISOString(),
      })),
      followUps: followUps.map((f) => ({
        id: f.id,
        title: locale === 'bn' ? f.titleBn : f.titleEn,
        action: locale === 'bn' ? f.actionBn : f.actionEn,
        dueDate: f.dueDate?.toISOString().slice(0, 10) ?? null,
        deepLink: f.deepLink,
      })),
      computedAt: risk.computedAt,
    };
  }
}

let service: FarmHealthService | null = null;

export function getFarmHealthService(): FarmHealthService {
  if (!service) service = new FarmHealthService();
  return service;
}
