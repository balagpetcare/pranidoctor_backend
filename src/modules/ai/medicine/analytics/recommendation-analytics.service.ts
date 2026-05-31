import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';
import type { RecommendationResult, RankedBrand } from '../medicine.types.js';

export type RecommendationLogEntry = {
  id: string;
  sessionId: string | null;
  userId: string | null;
  customerId: string | null;
  organizationId: string | null;
  genericId: string;
  query: string | null;
  species: LivestockSpecies | null;
  region: string | null;
  rankedBrandsJson: unknown;
  winningBrandId: string | null;
  contractFactorsJson: unknown;
  sponsorFactorsJson: unknown;
  reasonCodesJson: unknown;
  totalScore: string;
  confidence: string;
  impressedAt: string;
  clickedAt: string | null;
  selectedAt: string | null;
};

export type RecommendationAnalyticsSummary = {
  totalImpressions: number;
  totalClicks: number;
  totalSelections: number;
  clickThroughRate: number;
  conversionRate: number;
  avgConfidence: number;
  topGenerics: Array<{ genericId: string; count: number }>;
  topBrands: Array<{ brandId: string; count: number }>;
  sponsorInfluenceRate: number;
};

export class RecommendationAnalyticsService {
  readonly name = 'RecommendationAnalyticsService';

  async logRecommendation(
    result: RecommendationResult,
    context: {
      sessionId?: string;
      userId?: string;
      customerId?: string;
      organizationId?: string;
    },
  ): Promise<string> {
    const prisma = getPrisma();

    const topBrand = result.rankedBrands[0];
    const allContractFactors = result.rankedBrands.flatMap((b) => b.contractFactors);
    const allSponsorFactors = result.rankedBrands.flatMap((b) => b.sponsorFactors);
    const allReasonCodes = [...new Set(result.rankedBrands.flatMap((b) => b.reasonCodes))];

    const log = await prisma.medicineRecommendationLog.create({
      data: {
        sessionId: context.sessionId ?? null,
        userId: context.userId ?? null,
        customerId: context.customerId ?? null,
        organizationId: context.organizationId ?? null,
        genericId: result.genericId,
        query: result.query || null,
        species: result.species,
        region: result.region,
        rankedBrandsJson: toInputJson(
          result.rankedBrands.map((b) => ({
            brandId: b.brandId,
            brandCode: b.brandCode,
            totalScore: b.totalScore,
            reasonCodes: b.reasonCodes,
          })),
        ),
        winningBrandId: topBrand?.brandId ?? null,
        contractFactorsJson: toInputJson(allContractFactors),
        sponsorFactorsJson: toInputJson(allSponsorFactors),
        reasonCodesJson: toInputJson(allReasonCodes),
        totalScore: topBrand?.totalScore ?? 0,
        confidence: result.confidence,
      },
    });

    return log.id;
  }

  async logClick(logId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.medicineRecommendationLog.update({
      where: { id: logId },
      data: { clickedAt: new Date() },
    });
  }

  async logSelection(logId: string, selectedBrandId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.medicineRecommendationLog.update({
      where: { id: logId },
      data: {
        selectedAt: new Date(),
        winningBrandId: selectedBrandId,
      },
    });
  }

  async getRecentLogs(options?: {
    genericId?: string;
    customerId?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: RecommendationLogEntry[]; total: number }> {
    const prisma = getPrisma();
    const where: Record<string, unknown> = {};

    if (options?.genericId) where.genericId = options.genericId;
    if (options?.customerId) where.customerId = options.customerId;
    if (options?.organizationId) where.organizationId = options.organizationId;

    const [rows, total] = await Promise.all([
      prisma.medicineRecommendationLog.findMany({
        where,
        orderBy: { impressedAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.medicineRecommendationLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        userId: row.userId,
        customerId: row.customerId,
        organizationId: row.organizationId,
        genericId: row.genericId,
        query: row.query,
        species: row.species,
        region: row.region,
        rankedBrandsJson: row.rankedBrandsJson,
        winningBrandId: row.winningBrandId,
        contractFactorsJson: row.contractFactorsJson,
        sponsorFactorsJson: row.sponsorFactorsJson,
        reasonCodesJson: row.reasonCodesJson,
        totalScore: row.totalScore.toString(),
        confidence: row.confidence.toString(),
        impressedAt: row.impressedAt.toISOString(),
        clickedAt: row.clickedAt?.toISOString() ?? null,
        selectedAt: row.selectedAt?.toISOString() ?? null,
      })),
      total,
    };
  }

  async getSummary(options?: {
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<RecommendationAnalyticsSummary> {
    const prisma = getPrisma();

    const where: Record<string, unknown> = {};
    if (options?.startDate || options?.endDate) {
      where.impressedAt = {};
      if (options?.startDate) (where.impressedAt as Record<string, unknown>).gte = options.startDate;
      if (options?.endDate) (where.impressedAt as Record<string, unknown>).lte = options.endDate;
    }
    if (options?.organizationId) where.organizationId = options.organizationId;

    const [totalImpressions, clicks, selections, avgData, topGenerics, topBrands] =
      await Promise.all([
        prisma.medicineRecommendationLog.count({ where }),
        prisma.medicineRecommendationLog.count({
          where: { ...where, clickedAt: { not: null } },
        }),
        prisma.medicineRecommendationLog.count({
          where: { ...where, selectedAt: { not: null } },
        }),
        prisma.medicineRecommendationLog.aggregate({
          where,
          _avg: { confidence: true },
        }),
        prisma.medicineRecommendationLog.groupBy({
          by: ['genericId'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        prisma.medicineRecommendationLog.groupBy({
          by: ['winningBrandId'],
          where: { ...where, winningBrandId: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
      ]);

    const sponsorInfluenceLogs = await prisma.medicineRecommendationLog.count({
      where: {
        ...where,
        sponsorFactorsJson: { not: '[]' },
      },
    });

    return {
      totalImpressions,
      totalClicks: clicks,
      totalSelections: selections,
      clickThroughRate: totalImpressions > 0 ? clicks / totalImpressions : 0,
      conversionRate: totalImpressions > 0 ? selections / totalImpressions : 0,
      avgConfidence: avgData._avg.confidence ? Number(avgData._avg.confidence) : 0,
      topGenerics: topGenerics.map((g) => ({
        genericId: g.genericId,
        count: g._count.id,
      })),
      topBrands: topBrands
        .filter((b) => b.winningBrandId)
        .map((b) => ({
          brandId: b.winningBrandId!,
          count: b._count.id,
        })),
      sponsorInfluenceRate: totalImpressions > 0 ? sponsorInfluenceLogs / totalImpressions : 0,
    };
  }

  async getSponsorImpactReport(
    companyId: string,
    options?: { startDate?: Date; endDate?: Date },
  ): Promise<{
    companyId: string;
    totalImpressions: number;
    sponsoredImpressions: number;
    sponsoredSelections: number;
    avgBoostScore: number;
    topBrands: Array<{ brandId: string; impressions: number; selections: number }>;
  }> {
    const prisma = getPrisma();

    const where: Record<string, unknown> = {};
    if (options?.startDate || options?.endDate) {
      where.impressedAt = {};
      if (options?.startDate) (where.impressedAt as Record<string, unknown>).gte = options.startDate;
      if (options?.endDate) (where.impressedAt as Record<string, unknown>).lte = options.endDate;
    }

    const logs = await prisma.medicineRecommendationLog.findMany({
      where,
      take: 10000,
    });

    let sponsoredImpressions = 0;
    let sponsoredSelections = 0;
    const brandStats = new Map<string, { impressions: number; selections: number }>();

    for (const log of logs) {
      const sponsorFactors = (log.sponsorFactorsJson as Array<{ companyId: string }>) ?? [];
      const hasCompanySponsor = sponsorFactors.some((f) => f.companyId === companyId);

      if (hasCompanySponsor) {
        sponsoredImpressions++;
        if (log.selectedAt) sponsoredSelections++;

        if (log.winningBrandId) {
          const stats = brandStats.get(log.winningBrandId) ?? { impressions: 0, selections: 0 };
          stats.impressions++;
          if (log.selectedAt) stats.selections++;
          brandStats.set(log.winningBrandId, stats);
        }
      }
    }

    const topBrands = Array.from(brandStats.entries())
      .map(([brandId, stats]) => ({ brandId, ...stats }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    return {
      companyId,
      totalImpressions: logs.length,
      sponsoredImpressions,
      sponsoredSelections,
      avgBoostScore: 0,
      topBrands,
    };
  }

  /**
   * Record when a vet overrides an AI recommendation
   */
  async recordVetOverride(data: {
    sessionId: string;
    userId: string;
    originalBrandId: string;
    selectedBrandId: string;
    overrideReason: 'CLINICAL_JUDGMENT' | 'PATIENT_HISTORY' | 'COST_CONCERN' | 'AVAILABILITY' | 'SAFETY_CONCERN' | 'OTHER';
    overrideNotes?: string;
    customerId?: string;
    organizationId?: string;
    genericCode: string;
    species?: LivestockSpecies;
    region?: string;
  }): Promise<void> {
    const prisma = getPrisma();

    // For compatibility with existing schema, we'll use the existing fields creatively
    await prisma.medicineRecommendationLog.create({
      data: {
        sessionId: data.sessionId,
        userId: data.userId,
        customerId: data.customerId,
        organizationId: data.organizationId,
        genericId: '', // We'll store the generic code in query field instead
        query: `VET_OVERRIDE:${data.genericCode}`,
        species: data.species,
        region: data.region,
        rankedBrandsJson: toInputJson({
          originalBrandId: data.originalBrandId,
          selectedBrandId: data.selectedBrandId,
          overrideReason: data.overrideReason,
          overrideNotes: data.overrideNotes,
        }),
        winningBrandId: data.selectedBrandId,
        contractFactorsJson: null,
        sponsorFactorsJson: null,
        reasonCodesJson: toInputJson([data.overrideReason]),
        totalScore: '0',
        confidence: '0',
      },
    });
  }

  /**
   * Record recommendation acceptance/rejection
   */
  async recordRecommendationDecision(data: {
    recommendationLogId: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
    rejectionReason?: 'SAFETY_CONCERN' | 'COST' | 'UNAVAILABLE' | 'PATIENT_UNSUITABLE' | 'OTHER';
    notes?: string;
  }): Promise<void> {
    const prisma = getPrisma();

    // Update the existing log entry
    await prisma.medicineRecommendationLog.update({
      where: { id: data.recommendationLogId },
      data: {
        selectedAt: data.decision === 'ACCEPTED' ? new Date() : null,
        reasonCodesJson: toInputJson({
          decision: data.decision,
          rejectionReason: data.rejectionReason,
          notes: data.notes,
        }),
      },
    });
  }

  /**
   * Get vet override analytics
   */
  async getVetOverrideAnalytics(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    userId?: string;
    organizationId?: string;
    customerId?: string;
    species?: LivestockSpecies;
    region?: string;
  }): Promise<{
    totalOverrides: number;
    overridesByReason: Record<string, number>;
    overrideRate: number;
    topOverriddenBrands: Array<{ brandId: string; brandName: string; overrideCount: number }>;
    overridesBySpecies: Record<LivestockSpecies, number>;
  }> {
    const prisma = getPrisma();

    const whereClause: any = {
      query: { startsWith: 'VET_OVERRIDE:' },
    };

    if (filters.dateFrom) whereClause.impressedAt = { gte: filters.dateFrom };
    if (filters.dateTo) whereClause.impressedAt = { ...whereClause.impressedAt, lte: filters.dateTo };
    if (filters.userId) whereClause.userId = filters.userId;
    if (filters.organizationId) whereClause.organizationId = filters.organizationId;
    if (filters.customerId) whereClause.customerId = filters.customerId;
    if (filters.species) whereClause.species = filters.species;
    if (filters.region) whereClause.region = filters.region;

    const overrides = await prisma.medicineRecommendationLog.findMany({
      where: whereClause,
    });

    const totalOverrides = overrides.length;

    // Calculate override rate (overrides vs total recommendations)
    const totalRecommendations = await prisma.medicineRecommendationLog.count({
      where: {
        ...whereClause,
        query: { not: { startsWith: 'VET_OVERRIDE:' } },
      },
    });

    const overrideRate = totalRecommendations > 0 ? (totalOverrides / (totalOverrides + totalRecommendations)) * 100 : 0;

    // Analyze overrides by reason
    const overridesByReason: Record<string, number> = {};
    const brandOverrides = new Map<string, number>();
    const speciesOverrides = new Map<LivestockSpecies, number>();

    overrides.forEach(override => {
      const rankedBrands = override.rankedBrandsJson as any;
      const reason = rankedBrands?.overrideReason || 'UNKNOWN';
      
      overridesByReason[reason] = (overridesByReason[reason] || 0) + 1;

      // Track brand overrides
      if (rankedBrands?.originalBrandId) {
        const count = brandOverrides.get(rankedBrands.originalBrandId) || 0;
        brandOverrides.set(rankedBrands.originalBrandId, count + 1);
      }

      // Track species overrides
      if (override.species) {
        const count = speciesOverrides.get(override.species as LivestockSpecies) || 0;
        speciesOverrides.set(override.species as LivestockSpecies, count + 1);
      }
    });

    // Get top overridden brands with names
    const topOverriddenBrands = await Promise.all(
      Array.from(brandOverrides.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(async ([brandId, count]) => {
          const brand = await prisma.medicineBrand.findUnique({
            where: { id: brandId },
            select: { brandNameEn: true },
          });
          return {
            brandId,
            brandName: brand?.brandNameEn || 'Unknown Brand',
            overrideCount: count,
          };
        })
    );

    return {
      totalOverrides,
      overridesByReason,
      overrideRate,
      topOverriddenBrands,
      overridesBySpecies: Object.fromEntries(speciesOverrides.entries()),
    };
  }

  /**
   * Get brand performance analytics
   */
  async getBrandPerformanceAnalytics(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    brandId?: string;
    companyId?: string;
    organizationId?: string;
    species?: LivestockSpecies;
    region?: string;
  }): Promise<{
    brandRankings: Array<{
      brandId: string;
      brandName: string;
      companyName: string;
      impressions: number;
      clicks: number;
      selections: number;
      overrides: number;
      performanceScore: number;
    }>;
  }> {
    const prisma = getPrisma();

    const whereClause: any = {};
    if (filters.dateFrom) whereClause.impressedAt = { gte: filters.dateFrom };
    if (filters.dateTo) whereClause.impressedAt = { ...whereClause.impressedAt, lte: filters.dateTo };
    if (filters.organizationId) whereClause.organizationId = filters.organizationId;
    if (filters.species) whereClause.species = filters.species;
    if (filters.region) whereClause.region = filters.region;

    // Get all recommendations (non-override)
    const recommendations = await prisma.medicineRecommendationLog.findMany({
      where: {
        ...whereClause,
        query: { not: { startsWith: 'VET_OVERRIDE:' } },
      },
      include: {
        // Would join with brand if foreign key existed
      },
    });

    // Get overrides
    const overrides = await prisma.medicineRecommendationLog.findMany({
      where: {
        ...whereClause,
        query: { startsWith: 'VET_OVERRIDE:' },
      },
    });

    // Aggregate by brand
    const brandStats = new Map<string, any>();

    // Process recommendations
    recommendations.forEach(rec => {
      const rankedBrands = rec.rankedBrandsJson as any;
      if (Array.isArray(rankedBrands)) {
        rankedBrands.forEach((brand: any, index: number) => {
          if (!brand.brandId) return;
          
          if (!brandStats.has(brand.brandId)) {
            brandStats.set(brand.brandId, {
              brandId: brand.brandId,
              impressions: 0,
              clicks: 0,
              selections: 0,
              overrides: 0,
            });
          }
          
          const stats = brandStats.get(brand.brandId);
          stats.impressions++;
          if (rec.clickedAt) stats.clicks++;
          if (rec.selectedAt && index === 0) stats.selections++; // Assume first brand was selected
        });
      }
    });

    // Process overrides
    overrides.forEach(override => {
      const rankedBrands = override.rankedBrandsJson as any;
      if (rankedBrands?.originalBrandId) {
        const stats = brandStats.get(rankedBrands.originalBrandId);
        if (stats) {
          stats.overrides++;
        }
      }
    });

    // Enhance with brand details and calculate performance scores
    const brandRankings = await Promise.all(
      Array.from(brandStats.values()).map(async (stats) => {
        const brand = await prisma.medicineBrand.findUnique({
          where: { id: stats.brandId },
          include: { company: true },
        });

        // Calculate performance score
        const clickRate = stats.impressions > 0 ? stats.clicks / stats.impressions : 0;
        const selectionRate = stats.clicks > 0 ? stats.selections / stats.clicks : 0;
        const overrideRate = stats.selections > 0 ? stats.overrides / stats.selections : 0;
        
        const performanceScore = (clickRate * 0.3) + (selectionRate * 0.5) - (overrideRate * 0.2);

        return {
          brandId: stats.brandId,
          brandName: brand?.brandNameEn || 'Unknown Brand',
          companyName: brand?.company?.nameEn || 'Unknown Company',
          impressions: stats.impressions,
          clicks: stats.clicks,
          selections: stats.selections,
          overrides: stats.overrides,
          performanceScore: Math.max(0, performanceScore),
        };
      })
    );

    return {
      brandRankings: brandRankings.sort((a, b) => b.performanceScore - a.performanceScore),
    };
  }

  /**
   * Get generic adoption analytics
   */
  async getGenericAdoptionAnalytics(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    therapeuticCategory?: string;
    organizationId?: string;
    species?: LivestockSpecies;
    region?: string;
  }): Promise<{
    totalGenericRecommendations: number;
    uniqueGenericsRecommended: number;
    topGenericsByAdoption: Array<{
      genericId: string;
      genericName: string;
      therapeuticCategory: string | null;
      recommendationCount: number;
      selectionRate: number;
      adoptionTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
    }>;
    adoptionByTherapeuticCategory: Record<string, number>;
    adoptionBySpecies: Record<LivestockSpecies, number>;
  }> {
    const prisma = getPrisma();

    const whereClause: any = {
      query: { not: { startsWith: 'VET_OVERRIDE:' } },
    };
    if (filters.dateFrom) whereClause.impressedAt = { gte: filters.dateFrom };
    if (filters.dateTo) whereClause.impressedAt = { ...whereClause.impressedAt, lte: filters.dateTo };
    if (filters.organizationId) whereClause.organizationId = filters.organizationId;
    if (filters.species) whereClause.species = filters.species;
    if (filters.region) whereClause.region = filters.region;

    const recommendations = await prisma.medicineRecommendationLog.findMany({
      where: whereClause,
    });

    const totalGenericRecommendations = recommendations.length;

    // Group by generic
    const genericStats = new Map<string, any>();
    const speciesStats = new Map<LivestockSpecies, number>();

    recommendations.forEach(rec => {
      // Group by generic
      if (!genericStats.has(rec.genericId)) {
        genericStats.set(rec.genericId, {
          genericId: rec.genericId,
          recommendations: 0,
          selections: 0,
        });
      }
      const stats = genericStats.get(rec.genericId);
      stats.recommendations++;
      if (rec.selectedAt) stats.selections++;

      // Group by species
      if (rec.species) {
        const count = speciesStats.get(rec.species as LivestockSpecies) || 0;
        speciesStats.set(rec.species as LivestockSpecies, count + 1);
      }
    });

    const uniqueGenericsRecommended = genericStats.size;

    // Get generic details and calculate adoption metrics
    const topGenericsByAdoption = await Promise.all(
      Array.from(genericStats.values())
        .sort((a, b) => b.recommendations - a.recommendations)
        .slice(0, 20)
        .map(async (stats) => {
          const generic = await prisma.medicineGeneric.findUnique({
            where: { id: stats.genericId },
          });

          const selectionRate = stats.recommendations > 0 ? (stats.selections / stats.recommendations) * 100 : 0;
          const adoptionTrend = selectionRate > 70 ? 'INCREASING' : 
                              selectionRate > 40 ? 'STABLE' : 'DECREASING';

          return {
            genericId: stats.genericId,
            genericName: generic?.genericNameEn || 'Unknown Generic',
            therapeuticCategory: generic?.therapeuticCategory || null,
            recommendationCount: stats.recommendations,
            selectionRate,
            adoptionTrend,
          };
        })
    );

    // Group adoption by therapeutic category
    const adoptionByTherapeuticCategory: Record<string, number> = {};
    for (const generic of topGenericsByAdoption) {
      const category = generic.therapeuticCategory || 'Unknown';
      adoptionByTherapeuticCategory[category] = (adoptionByTherapeuticCategory[category] || 0) + generic.recommendationCount;
    }

    return {
      totalGenericRecommendations,
      uniqueGenericsRecommended,
      topGenericsByAdoption,
      adoptionByTherapeuticCategory,
      adoptionBySpecies: Object.fromEntries(speciesStats.entries()),
    };
  }
}

let service: RecommendationAnalyticsService | null = null;

export function getRecommendationAnalyticsService(): RecommendationAnalyticsService {
  if (!service) service = new RecommendationAnalyticsService();
  return service;
}

export function resetRecommendationAnalyticsServiceForTests(): void {
  service = null;
}
