import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getTherapeuticClassificationService } from '../knowledge/therapeutic-classification.service.js';
import type { RankedBrand, ContractFactor, SponsorFactor } from '../medicine.types.js';

export type BiasPreventionConfig = {
  maxCommercialInfluence: number; // 0-1, maximum total commercial boost as % of base score
  safetyOverrideThreshold: number; // 0-1, minimum safety score required
  transparencyThreshold: number; // Above this influence level, must be explicitly disclosed
  sponsorCapPerContract: number; // Maximum boost per sponsor contract
  campaignCapPerContract: number; // Maximum boost per campaign
  organizationCapPerContract: number; // Maximum boost per organization
  regionalCapPerContract: number; // Maximum boost per region
  maxCumulativeBoost: number; // Maximum total boost from all sources
  auditLogThreshold: number; // Above this level, log for audit
};

export type SafetyAssessment = {
  safetyScore: number; // 0-1, higher is safer
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  safetyFactors: string[];
  warnings: string[];
  requiresVetApproval: boolean;
};

export type BiasAssessment = {
  totalCommercialInfluence: number; // 0-1
  influenceByType: {
    sponsor: number;
    campaign: number;
    organization: number;
    regional: number;
  };
  influenceFactors: Array<{
    type: 'SPONSOR' | 'CAMPAIGN' | 'ORGANIZATION' | 'REGIONAL';
    source: string;
    influence: number;
    capped: boolean;
    originalValue: number;
  }>;
  exceedsTransparencyThreshold: boolean;
  exceedsSafetyThreshold: boolean;
  recommendationAdjustment: 'NONE' | 'CAP_APPLIED' | 'SAFETY_OVERRIDE' | 'BLOCKED';
};

export type GovernanceResult = {
  originalRanking: RankedBrand[];
  adjustedRanking: RankedBrand[];
  biasAssessment: BiasAssessment;
  safetyAssessment: SafetyAssessment;
  governanceActions: Array<{
    action: 'CAP_SPONSOR' | 'CAP_CAMPAIGN' | 'SAFETY_OVERRIDE' | 'TRANSPARENCY_FLAG' | 'BLOCK_UNSAFE';
    reason: string;
    brandId: string;
    originalScore: number;
    adjustedScore: number;
  }>;
  auditRequired: boolean;
  disclaimerLevel: 'STANDARD' | 'ENHANCED' | 'CRITICAL';
};

// Default configuration emphasizing safety over commercial interests
export const DEFAULT_BIAS_PREVENTION_CONFIG: BiasPreventionConfig = {
  maxCommercialInfluence: 0.25, // Max 25% boost from commercial factors
  safetyOverrideThreshold: 0.7, // Minimum 70% safety score required
  transparencyThreshold: 0.15, // Disclose if >15% commercial influence
  sponsorCapPerContract: 10, // Max 10 point boost per sponsor
  campaignCapPerContract: 8, // Max 8 point boost per campaign
  organizationCapPerContract: 6, // Max 6 point boost per organization
  regionalCapPerContract: 4, // Max 4 point boost per region
  maxCumulativeBoost: 20, // Max 20 point total boost
  auditLogThreshold: 0.2, // Log if >20% commercial influence
};

export class CommercialBiasPreventionService {
  readonly name = 'CommercialBiasPreventionService';

  private config: BiasPreventionConfig;
  private therapeuticClassification = getTherapeuticClassificationService();

  constructor(config?: Partial<BiasPreventionConfig>) {
    this.config = { ...DEFAULT_BIAS_PREVENTION_CONFIG, ...config };
  }

  /**
   * Apply governance rules to prevent commercial bias from overriding safety
   */
  async applyGovernanceRules(
    rankedBrands: RankedBrand[],
    context: {
      genericCode: string;
      species?: LivestockSpecies;
      isEmergency?: boolean;
      userType?: 'FARMER' | 'VET' | 'TECHNICIAN';
    }
  ): Promise<GovernanceResult> {
    const originalRanking = [...rankedBrands];
    
    // Assess safety for each brand
    const safetyAssessments = await Promise.all(
      rankedBrands.map(brand => this.assessBrandSafety(brand, context))
    );

    // Assess commercial bias
    const biasAssessments = rankedBrands.map(brand => this.assessCommercialBias(brand));

    // Apply governance adjustments
    const { adjustedRanking, governanceActions } = await this.applyAdjustments(
      rankedBrands,
      safetyAssessments,
      biasAssessments,
      context
    );

    // Overall assessments
    const overallSafetyAssessment = this.aggregateSafetyAssessment(safetyAssessments);
    const overallBiasAssessment = this.aggregateBiasAssessment(biasAssessments);

    // Determine audit requirements
    const auditRequired = this.determineAuditRequirement(overallBiasAssessment, governanceActions);

    // Determine disclaimer level
    const disclaimerLevel = this.determineDisclaimerLevel(overallSafetyAssessment, overallBiasAssessment);

    return {
      originalRanking,
      adjustedRanking,
      biasAssessment: overallBiasAssessment,
      safetyAssessment: overallSafetyAssessment,
      governanceActions,
      auditRequired,
      disclaimerLevel,
    };
  }

  /**
   * Assess safety of a specific brand
   */
  private async assessBrandSafety(
    brand: RankedBrand,
    context: { genericCode: string; species?: LivestockSpecies; isEmergency?: boolean }
  ): Promise<SafetyAssessment> {
    // Get therapeutic classification and safety info
    const classification = await this.therapeuticClassification.getTherapeuticClassification(context.genericCode);
    
    const safetyValidation = await this.therapeuticClassification.validateMedicineSafety(
      context.genericCode,
      {
        species: context.species,
        // Add other context as available
      }
    );

    // Calculate safety score based on multiple factors
    let safetyScore = 1.0; // Start with perfect safety

    // Reduce score for contraindications
    if (!safetyValidation.isApproved) {
      safetyScore *= 0.3; // Major reduction for contraindicated medicines
    }

    // Reduce score for warnings
    const highSeverityWarnings = safetyValidation.warnings.filter(w => w.severity === 'HIGH');
    safetyScore *= Math.pow(0.8, highSeverityWarnings.length);

    // Reduce score for absolute contraindications
    const absoluteContraindications = safetyValidation.contraindications.filter(c => c.severity === 'ABSOLUTE');
    if (absoluteContraindications.length > 0) {
      safetyScore = 0; // Complete safety failure
    }

    // Determine risk level
    let riskLevel: SafetyAssessment['riskLevel'] = 'LOW';
    if (safetyScore <= 0.3) riskLevel = 'CRITICAL';
    else if (safetyScore <= 0.5) riskLevel = 'HIGH';
    else if (safetyScore <= 0.7) riskLevel = 'MEDIUM';

    // Collect safety factors and warnings
    const safetyFactors: string[] = [];
    const warnings: string[] = [];

    if (classification.therapeuticClass) {
      safetyFactors.push(`Therapeutic class: ${classification.therapeuticClass.classNameEn}`);
      warnings.push(...classification.therapeuticClass.safetyWarnings);
    }

    if (classification.contraindications.length > 0) {
      safetyFactors.push(`${classification.contraindications.length} contraindication(s) found`);
    }

    warnings.push(...safetyValidation.warnings.map(w => w.message));

    return {
      safetyScore,
      riskLevel,
      safetyFactors,
      warnings,
      requiresVetApproval: !safetyValidation.isApproved || riskLevel !== 'LOW',
    };
  }

  /**
   * Assess commercial bias in a brand's ranking
   */
  private assessCommercialBias(brand: RankedBrand): BiasAssessment {
    const baseScore = brand.baseScore;
    const totalScore = brand.totalScore;

    // Calculate commercial influence as percentage of base score
    const commercialBoost = totalScore - baseScore - brand.availabilityBonus + brand.pricePenalty;
    const totalCommercialInfluence = commercialBoost / Math.max(baseScore, 1);

    // Break down influence by type
    const influenceByType = {
      sponsor: brand.sponsorBoost / Math.max(baseScore, 1),
      campaign: brand.campaignBoost / Math.max(baseScore, 1),
      organization: brand.organizationBoost / Math.max(baseScore, 1),
      regional: brand.regionBoost / Math.max(baseScore, 1),
    };

    // Analyze influence factors
    const influenceFactors: BiasAssessment['influenceFactors'] = [];

    // Process sponsor factors
    for (const sponsor of brand.sponsorFactors) {
      const influence = sponsor.contribution / Math.max(baseScore, 1);
      const capped = sponsor.contribution > this.config.sponsorCapPerContract;
      
      influenceFactors.push({
        type: 'SPONSOR',
        source: sponsor.companyNameEn,
        influence,
        capped,
        originalValue: sponsor.contribution,
      });
    }

    // Process contract factors
    for (const contract of brand.contractFactors) {
      const influence = contract.boostScore / Math.max(baseScore, 1);
      let cap: number;
      
      switch (contract.contractType) {
        case 'CAMPAIGN':
          cap = this.config.campaignCapPerContract;
          break;
        case 'ORGANIZATION':
          cap = this.config.organizationCapPerContract;
          break;
        case 'REGIONAL':
          cap = this.config.regionalCapPerContract;
          break;
        default:
          cap = this.config.sponsorCapPerContract;
      }
      
      const capped = contract.boostScore > cap;
      
      influenceFactors.push({
        type: contract.contractType,
        source: contract.contractCode,
        influence,
        capped,
        originalValue: contract.boostScore,
      });
    }

    // Determine if thresholds are exceeded
    const exceedsTransparencyThreshold = totalCommercialInfluence > this.config.transparencyThreshold;
    const exceedsSafetyThreshold = totalCommercialInfluence > this.config.maxCommercialInfluence;

    // Determine recommendation adjustment
    let recommendationAdjustment: BiasAssessment['recommendationAdjustment'] = 'NONE';
    
    if (exceedsSafetyThreshold) {
      recommendationAdjustment = 'SAFETY_OVERRIDE';
    } else if (influenceFactors.some(f => f.capped)) {
      recommendationAdjustment = 'CAP_APPLIED';
    }

    return {
      totalCommercialInfluence: Math.max(0, totalCommercialInfluence),
      influenceByType,
      influenceFactors,
      exceedsTransparencyThreshold,
      exceedsSafetyThreshold,
      recommendationAdjustment,
    };
  }

  /**
   * Apply governance adjustments to rankings
   */
  private async applyAdjustments(
    brands: RankedBrand[],
    safetyAssessments: SafetyAssessment[],
    biasAssessments: BiasAssessment[],
    context: any
  ): Promise<{ adjustedRanking: RankedBrand[]; governanceActions: GovernanceResult['governanceActions'] }> {
    const adjustedBrands: RankedBrand[] = [];
    const governanceActions: GovernanceResult['governanceActions'] = [];

    for (let i = 0; i < brands.length; i++) {
      const brand = { ...brands[i] };
      const safetyAssessment = safetyAssessments[i];
      const biasAssessment = biasAssessments[i];
      const originalScore = brand.totalScore;

      // SAFETY FIRST: Block unsafe medicines
      if (safetyAssessment.riskLevel === 'CRITICAL' || safetyAssessment.safetyScore === 0) {
        governanceActions.push({
          action: 'BLOCK_UNSAFE',
          reason: `Critical safety risk: ${safetyAssessment.warnings.join(', ')}`,
          brandId: brand.brandId,
          originalScore,
          adjustedScore: 0,
        });
        continue; // Skip this brand entirely
      }

      // Apply commercial influence caps
      let adjustedScore = brand.baseScore + brand.availabilityBonus + brand.pricePenalty;
      let totalCommercialBoost = 0;

      // Cap sponsor boost
      const cappedSponsorBoost = Math.min(brand.sponsorBoost, this.config.sponsorCapPerContract);
      if (cappedSponsorBoost < brand.sponsorBoost) {
        governanceActions.push({
          action: 'CAP_SPONSOR',
          reason: `Sponsor boost capped at ${this.config.sponsorCapPerContract}`,
          brandId: brand.brandId,
          originalScore: brand.sponsorBoost,
          adjustedScore: cappedSponsorBoost,
        });
      }
      totalCommercialBoost += cappedSponsorBoost;

      // Cap campaign boost
      const cappedCampaignBoost = Math.min(brand.campaignBoost, this.config.campaignCapPerContract);
      if (cappedCampaignBoost < brand.campaignBoost) {
        governanceActions.push({
          action: 'CAP_CAMPAIGN',
          reason: `Campaign boost capped at ${this.config.campaignCapPerContract}`,
          brandId: brand.brandId,
          originalScore: brand.campaignBoost,
          adjustedScore: cappedCampaignBoost,
        });
      }
      totalCommercialBoost += cappedCampaignBoost;

      // Add other boosts (with their respective caps)
      totalCommercialBoost += Math.min(brand.organizationBoost, this.config.organizationCapPerContract);
      totalCommercialBoost += Math.min(brand.regionBoost, this.config.regionalCapPerContract);

      // Apply maximum cumulative boost
      const finalCommercialBoost = Math.min(totalCommercialBoost, this.config.maxCumulativeBoost);
      adjustedScore += finalCommercialBoost;

      // Safety override: reduce score if safety is compromised
      if (safetyAssessment.riskLevel === 'HIGH') {
        const safetyPenalty = adjustedScore * 0.5; // 50% penalty for high risk
        adjustedScore -= safetyPenalty;
        
        governanceActions.push({
          action: 'SAFETY_OVERRIDE',
          reason: `High safety risk detected: ${safetyAssessment.warnings.slice(0, 2).join(', ')}`,
          brandId: brand.brandId,
          originalScore,
          adjustedScore,
        });
      } else if (safetyAssessment.riskLevel === 'MEDIUM') {
        const safetyPenalty = adjustedScore * 0.2; // 20% penalty for medium risk
        adjustedScore -= safetyPenalty;
        
        governanceActions.push({
          action: 'SAFETY_OVERRIDE',
          reason: `Medium safety risk detected`,
          brandId: brand.brandId,
          originalScore,
          adjustedScore,
        });
      }

      // Transparency flagging
      if (biasAssessment.exceedsTransparencyThreshold) {
        governanceActions.push({
          action: 'TRANSPARENCY_FLAG',
          reason: `Commercial influence (${(biasAssessment.totalCommercialInfluence * 100).toFixed(1)}%) exceeds transparency threshold`,
          brandId: brand.brandId,
          originalScore,
          adjustedScore,
        });
      }

      // Update brand with adjusted scores
      brand.totalScore = Math.max(0, adjustedScore);
      brand.sponsorBoost = cappedSponsorBoost;
      brand.campaignBoost = cappedCampaignBoost;
      brand.organizationBoost = Math.min(brand.organizationBoost, this.config.organizationCapPerContract);
      brand.regionBoost = Math.min(brand.regionBoost, this.config.regionalCapPerContract);

      adjustedBrands.push(brand);
    }

    // Re-sort by adjusted scores
    adjustedBrands.sort((a, b) => b.totalScore - a.totalScore);

    return { adjustedRanking: adjustedBrands, governanceActions };
  }

  private aggregateSafetyAssessment(assessments: SafetyAssessment[]): SafetyAssessment {
    if (assessments.length === 0) {
      return {
        safetyScore: 0,
        riskLevel: 'CRITICAL',
        safetyFactors: [],
        warnings: ['No brands available for safety assessment'],
        requiresVetApproval: true,
      };
    }

    const avgSafetyScore = assessments.reduce((sum, a) => sum + a.safetyScore, 0) / assessments.length;
    const maxRiskLevel = this.getMaxRiskLevel(assessments.map(a => a.riskLevel));
    const allWarnings = assessments.flatMap(a => a.warnings);
    const allSafetyFactors = assessments.flatMap(a => a.safetyFactors);
    const requiresVetApproval = assessments.some(a => a.requiresVetApproval);

    return {
      safetyScore: avgSafetyScore,
      riskLevel: maxRiskLevel,
      safetyFactors: [...new Set(allSafetyFactors)],
      warnings: [...new Set(allWarnings)],
      requiresVetApproval,
    };
  }

  private aggregateBiasAssessment(assessments: BiasAssessment[]): BiasAssessment {
    if (assessments.length === 0) {
      return {
        totalCommercialInfluence: 0,
        influenceByType: { sponsor: 0, campaign: 0, organization: 0, regional: 0 },
        influenceFactors: [],
        exceedsTransparencyThreshold: false,
        exceedsSafetyThreshold: false,
        recommendationAdjustment: 'NONE',
      };
    }

    const avgInfluence = assessments.reduce((sum, a) => sum + a.totalCommercialInfluence, 0) / assessments.length;
    const maxInfluence = Math.max(...assessments.map(a => a.totalCommercialInfluence));
    
    return {
      totalCommercialInfluence: maxInfluence,
      influenceByType: {
        sponsor: Math.max(...assessments.map(a => a.influenceByType.sponsor)),
        campaign: Math.max(...assessments.map(a => a.influenceByType.campaign)),
        organization: Math.max(...assessments.map(a => a.influenceByType.organization)),
        regional: Math.max(...assessments.map(a => a.influenceByType.regional)),
      },
      influenceFactors: assessments.flatMap(a => a.influenceFactors),
      exceedsTransparencyThreshold: assessments.some(a => a.exceedsTransparencyThreshold),
      exceedsSafetyThreshold: assessments.some(a => a.exceedsSafetyThreshold),
      recommendationAdjustment: assessments.some(a => a.recommendationAdjustment !== 'NONE') ? 'CAP_APPLIED' : 'NONE',
    };
  }

  private getMaxRiskLevel(riskLevels: SafetyAssessment['riskLevel'][]): SafetyAssessment['riskLevel'] {
    if (riskLevels.includes('CRITICAL')) return 'CRITICAL';
    if (riskLevels.includes('HIGH')) return 'HIGH';
    if (riskLevels.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private determineAuditRequirement(biasAssessment: BiasAssessment, actions: GovernanceResult['governanceActions']): boolean {
    return biasAssessment.totalCommercialInfluence > this.config.auditLogThreshold ||
           actions.some(a => ['SAFETY_OVERRIDE', 'BLOCK_UNSAFE'].includes(a.action));
  }

  private determineDisclaimerLevel(
    safetyAssessment: SafetyAssessment,
    biasAssessment: BiasAssessment
  ): GovernanceResult['disclaimerLevel'] {
    if (safetyAssessment.riskLevel === 'CRITICAL' || safetyAssessment.riskLevel === 'HIGH') {
      return 'CRITICAL';
    }
    
    if (biasAssessment.exceedsSafetyThreshold || safetyAssessment.riskLevel === 'MEDIUM') {
      return 'ENHANCED';
    }
    
    return 'STANDARD';
  }
}

let service: CommercialBiasPreventionService | null = null;

export function getCommercialBiasPreventionService(config?: Partial<BiasPreventionConfig>): CommercialBiasPreventionService {
  if (!service) service = new CommercialBiasPreventionService(config);
  return service;
}

export function resetCommercialBiasPreventionServiceForTests(): void {
  service = null;
}