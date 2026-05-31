import type { LivestockSpecies, RecommendationReasonCode } from '../../../../generated/prisma/index.js';
import { getBrandRegistryService } from '../knowledge/brand-registry.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import { getContractEvaluationEngine } from '../contracts/contract-evaluation.engine.js';
import {
  MEDICINE_RANKING_CONFIG,
  AVAILABILITY_SCORE_MAP,
} from '../medicine.constants.js';
import type {
  RankedBrand,
  RecommendationResult,
  RecommendationExplainability,
  RecommendationQuery,
  MedicineBrandView,
} from '../medicine.types.js';

export class RankingEngine {
  readonly name = 'RankingEngine';

  private genericRegistry = getGenericRegistryService();
  private brandRegistry = getBrandRegistryService();
  private contractEvaluator = getContractEvaluationEngine();

  async rank(query: RecommendationQuery): Promise<RecommendationResult | null> {
    const generic = await this.resolveGeneric(query);
    if (!generic) return null;

    if (generic.bannedSubstance) {
      return this.createBannedResult(generic, query);
    }

    const eligibleBrands = await this.getEligibleBrands(generic.id, query);
    if (eligibleBrands.length === 0) {
      return this.createEmptyResult(generic, query);
    }

    const rankedBrands = await this.rankBrands(eligibleBrands, {
      genericId: generic.id,
      organizationId: query.organizationId,
      region: query.region,
      customerId: query.customerId,
    });

    const sortedBrands = rankedBrands
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, query.limit ?? MEDICINE_RANKING_CONFIG.DEFAULT_RANKING_LIMIT);

    const explainability = this.buildExplainability(sortedBrands, query);
    const confidence = this.calculateConfidence(sortedBrands, eligibleBrands.length);

    return {
      genericId: generic.id,
      genericCode: generic.genericCode,
      genericNameEn: generic.genericNameEn,
      query: query.query ?? '',
      species: query.species ?? null,
      region: query.region ?? null,
      rankedBrands: sortedBrands,
      totalBrands: eligibleBrands.length,
      confidence,
      explainability,
    };
  }

  private async resolveGeneric(query: RecommendationQuery) {
    if (query.genericId) {
      try {
        return await this.genericRegistry.getById(query.genericId);
      } catch {
        return null;
      }
    }

    if (query.genericCode) {
      return this.genericRegistry.findByCode(query.genericCode);
    }

    if (query.query) {
      const results = await this.genericRegistry.searchByName(query.query, {
        species: query.species,
        limit: 1,
      });
      return results[0] ?? null;
    }

    return null;
  }

  private async getEligibleBrands(
    genericId: string,
    query: RecommendationQuery,
  ): Promise<MedicineBrandView[]> {
    const brands = await this.brandRegistry.getBrandsForGeneric(genericId, { isActive: true });
    return brands;
  }

  private async rankBrands(
    brands: MedicineBrandView[],
    context: {
      genericId: string;
      organizationId?: string;
      region?: string;
      customerId?: string;
    },
  ): Promise<RankedBrand[]> {
    const rankedBrands: RankedBrand[] = [];

    const contractEvaluations = await this.contractEvaluator.evaluateForMultipleBrands(
      brands.map((b) => ({ brandId: b.id, companyId: b.companyId })),
      {
        genericId: context.genericId,
        organizationId: context.organizationId,
        region: context.region,
        customerId: context.customerId,
      },
    );

    for (const brand of brands) {
      const contractEval = contractEvaluations.get(brand.id);

      const baseScore = MEDICINE_RANKING_CONFIG.DEFAULT_BASE_SCORE;
      const contractBoost =
        (contractEval?.totalContractBoost ?? 0) *
        MEDICINE_RANKING_CONFIG.CONTRACT_WEIGHT_MULTIPLIER;
      const sponsorBoost =
        (contractEval?.totalSponsorBoost ?? 0) *
        MEDICINE_RANKING_CONFIG.SPONSOR_WEIGHT_MULTIPLIER;

      const availabilityBonus = this.calculateAvailabilityBonus(brand.bdAvailability);
      const pricePenalty = this.calculatePricePenalty(brand.mrpBdt, brands);

      const campaignBoost = this.extractCampaignBoost(contractEval);
      const regionBoost = this.extractRegionBoost(contractEval, context.region);
      const organizationBoost = this.extractOrganizationBoost(contractEval, context.organizationId);

      const totalScore =
        baseScore +
        contractBoost +
        sponsorBoost +
        campaignBoost +
        regionBoost +
        organizationBoost +
        availabilityBonus -
        pricePenalty;

      const reasonCodes = this.generateReasonCodes({
        contractBoost,
        sponsorBoost,
        campaignBoost,
        regionBoost,
        organizationBoost,
        availabilityBonus,
        pricePenalty,
      });

      rankedBrands.push({
        brandId: brand.id,
        brandCode: brand.brandCode,
        brandNameEn: brand.brandNameEn,
        brandNameBn: brand.brandNameBn,
        companyId: brand.companyId,
        companyNameEn: brand.companyNameEn,
        genericId: brand.genericId,
        genericNameEn: brand.genericNameEn,
        totalScore: Math.round(totalScore * 100) / 100,
        baseScore,
        contractBoost: Math.round(contractBoost * 100) / 100,
        sponsorBoost: Math.round(sponsorBoost * 100) / 100,
        campaignBoost: Math.round(campaignBoost * 100) / 100,
        regionBoost: Math.round(regionBoost * 100) / 100,
        organizationBoost: Math.round(organizationBoost * 100) / 100,
        availabilityBonus: Math.round(availabilityBonus * 100) / 100,
        pricePenalty: Math.round(pricePenalty * 100) / 100,
        mrpBdt: brand.mrpBdt,
        form: brand.form,
        strengthValue: brand.strengthValue,
        strengthUnit: brand.strengthUnit,
        reasonCodes,
        contractFactors: contractEval?.contractFactors ?? [],
        sponsorFactors: contractEval?.sponsorFactors ?? [],
      });
    }

    return rankedBrands;
  }

  private calculateAvailabilityBonus(availability: string): number {
    const score = AVAILABILITY_SCORE_MAP[availability as keyof typeof AVAILABILITY_SCORE_MAP] ?? 0.5;
    return score * MEDICINE_RANKING_CONFIG.DEFAULT_BASE_SCORE * MEDICINE_RANKING_CONFIG.AVAILABILITY_BONUS_MULTIPLIER;
  }

  private calculatePricePenalty(mrpBdt: string | null, allBrands: MedicineBrandView[]): number {
    if (!mrpBdt) return 0;

    const prices = allBrands
      .map((b) => (b.mrpBdt ? parseFloat(b.mrpBdt) : null))
      .filter((p): p is number => p !== null);

    if (prices.length === 0) return 0;

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const brandPrice = parseFloat(mrpBdt);

    if (brandPrice > avgPrice * 1.2) {
      const priceDiff = (brandPrice - avgPrice) / avgPrice;
      return priceDiff * MEDICINE_RANKING_CONFIG.DEFAULT_BASE_SCORE * MEDICINE_RANKING_CONFIG.PRICE_PENALTY_MULTIPLIER;
    }

    return 0;
  }

  private extractCampaignBoost(contractEval?: { contractFactors: Array<{ contractType: string; boostScore: number; weight: number }> }): number {
    if (!contractEval) return 0;
    const campaignFactors = contractEval.contractFactors.filter((f) => f.contractType === 'CAMPAIGN');
    return campaignFactors.reduce((sum, f) => sum + f.boostScore * f.weight, 0) * MEDICINE_RANKING_CONFIG.CAMPAIGN_WEIGHT_MULTIPLIER;
  }

  private extractRegionBoost(contractEval?: { contractFactors: Array<{ contractType: string; boostScore: number; weight: number }> }, region?: string): number {
    if (!contractEval || !region) return 0;
    const regionFactors = contractEval.contractFactors.filter((f) => f.contractType === 'REGIONAL');
    return regionFactors.reduce((sum, f) => sum + f.boostScore * f.weight, 0) * MEDICINE_RANKING_CONFIG.REGION_WEIGHT_MULTIPLIER;
  }

  private extractOrganizationBoost(contractEval?: { contractFactors: Array<{ contractType: string; boostScore: number; weight: number }> }, orgId?: string): number {
    if (!contractEval || !orgId) return 0;
    const orgFactors = contractEval.contractFactors.filter((f) => f.contractType === 'ORGANIZATION');
    return orgFactors.reduce((sum, f) => sum + f.boostScore * f.weight, 0) * MEDICINE_RANKING_CONFIG.ORGANIZATION_WEIGHT_MULTIPLIER;
  }

  private generateReasonCodes(scores: {
    contractBoost: number;
    sponsorBoost: number;
    campaignBoost: number;
    regionBoost: number;
    organizationBoost: number;
    availabilityBonus: number;
    pricePenalty: number;
  }): RecommendationReasonCode[] {
    const codes: RecommendationReasonCode[] = ['GENERIC_FIRST'];

    if (scores.sponsorBoost > 0) codes.push('CONTRACT_SPONSOR');
    if (scores.campaignBoost > 0) codes.push('CONTRACT_CAMPAIGN');
    if (scores.organizationBoost > 0) codes.push('CONTRACT_ORGANIZATION');
    if (scores.regionBoost > 0) codes.push('CONTRACT_REGIONAL');
    if (scores.availabilityBonus > 2) codes.push('AVAILABILITY_SCORE');
    if (scores.pricePenalty === 0) codes.push('PRICE_COMPETITIVE');

    return codes;
  }

  private buildExplainability(
    rankedBrands: RankedBrand[],
    query: RecommendationQuery,
  ): RecommendationExplainability {
    const hasContracts = rankedBrands.some((b) => b.contractFactors.length > 0);
    const hasSponsor = rankedBrands.some((b) => b.sponsorFactors.length > 0);
    const hasRegion = query.region !== undefined;
    const hasOrg = query.organizationId !== undefined;

    const filters: string[] = [];
    if (query.species) filters.push(`species=${query.species}`);
    if (query.region) filters.push(`region=${query.region}`);
    if (query.organizationId) filters.push(`organization=${query.organizationId}`);

    const rankingFactors: string[] = ['generic-first'];
    if (hasContracts) rankingFactors.push('active-contracts');
    if (hasSponsor) rankingFactors.push('sponsor-influence');
    rankingFactors.push('availability', 'price');

    return {
      genericFirstApplied: true,
      activeContractsCount: rankedBrands.reduce((sum, b) => sum + b.contractFactors.length, 0),
      sponsorInfluencePresent: hasSponsor,
      regionMatchApplied: hasRegion && rankedBrands.some((b) => b.regionBoost > 0),
      organizationMatchApplied: hasOrg && rankedBrands.some((b) => b.organizationBoost > 0),
      filters,
      rankingFactors,
    };
  }

  private calculateConfidence(rankedBrands: RankedBrand[], totalEligible: number): number {
    if (rankedBrands.length === 0) return 0;
    if (totalEligible === 0) return 0;

    const topScore = rankedBrands[0]?.totalScore ?? 0;
    const avgScore =
      rankedBrands.reduce((sum, b) => sum + b.totalScore, 0) / rankedBrands.length;

    const scoreDiff = topScore - avgScore;
    const scoreDiffNormalized = Math.min(scoreDiff / 20, 1);

    const coverageScore = Math.min(rankedBrands.length / 5, 1);

    const confidence = 0.5 + scoreDiffNormalized * 0.3 + coverageScore * 0.2;
    return Math.min(Math.max(confidence, 0), 1);
  }

  private createBannedResult(generic: { id: string; genericCode: string; genericNameEn: string }, query: RecommendationQuery): RecommendationResult {
    return {
      genericId: generic.id,
      genericCode: generic.genericCode,
      genericNameEn: generic.genericNameEn,
      query: query.query ?? '',
      species: query.species ?? null,
      region: query.region ?? null,
      rankedBrands: [],
      totalBrands: 0,
      confidence: 0,
      explainability: {
        genericFirstApplied: false,
        activeContractsCount: 0,
        sponsorInfluencePresent: false,
        regionMatchApplied: false,
        organizationMatchApplied: false,
        filters: ['BANNED_SUBSTANCE'],
        rankingFactors: [],
      },
    };
  }

  private createEmptyResult(generic: { id: string; genericCode: string; genericNameEn: string }, query: RecommendationQuery): RecommendationResult {
    return {
      genericId: generic.id,
      genericCode: generic.genericCode,
      genericNameEn: generic.genericNameEn,
      query: query.query ?? '',
      species: query.species ?? null,
      region: query.region ?? null,
      rankedBrands: [],
      totalBrands: 0,
      confidence: 0,
      explainability: {
        genericFirstApplied: true,
        activeContractsCount: 0,
        sponsorInfluencePresent: false,
        regionMatchApplied: false,
        organizationMatchApplied: false,
        filters: [],
        rankingFactors: ['no-brands-available'],
      },
    };
  }
}

let engine: RankingEngine | null = null;

export function getRankingEngine(): RankingEngine {
  if (!engine) engine = new RankingEngine();
  return engine;
}

export function resetRankingEngineForTests(): void {
  engine = null;
}
