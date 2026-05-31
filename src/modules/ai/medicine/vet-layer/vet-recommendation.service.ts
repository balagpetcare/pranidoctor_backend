import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getRankingEngine } from '../recommendation/ranking.engine.js';
import { getConflictResolutionEngine } from '../recommendation/conflict-resolution.engine.js';
import { getCommercialBiasPreventionService } from '../governance/commercial-bias-prevention.service.js';
import { getContractService } from '../contracts/contract.service.js';
import { getGenericRegistryService } from '../knowledge/generic-registry.service.js';
import type {
  RecommendationResult,
  RecommendationQuery,
  ConflictResolutionResult,
} from '../medicine.types.js';

export type VetRecommendationRequest = {
  genericId?: string;
  genericCode?: string;
  query?: string;
  species?: LivestockSpecies;
  region?: string;
  organizationId?: string;
  customerId?: string;
  userId?: string;
  sessionId?: string;
  limit?: number;
};

export type VetRecommendationResponse = {
  success: boolean;
  recommendation: RecommendationResult | null;
  safetyWarnings: SafetyWarning[];
  conflictResolution: ConflictResolutionResult | null;
  disclaimer: string;
  isAssistiveOnly: boolean;
  requiresVetApproval: boolean;
};

export type SafetyWarning = {
  code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  action?: string;
};

const VET_RECOMMENDATION_DISCLAIMER = `
This recommendation is provided for informational purposes only and is NOT a prescription.
All treatment decisions must be made by a qualified veterinarian.
This system does not autonomously prescribe, diagnose, or create treatment plans.
Sponsor and commercial factors are transparently displayed for your consideration.
`.trim();

export class VetRecommendationService {
  readonly name = 'VetRecommendationService';

  private rankingEngine = getRankingEngine();
  private conflictResolver = getConflictResolutionEngine();
  private contractService = getContractService();
  private genericRegistry = getGenericRegistryService();

  async getRecommendation(request: VetRecommendationRequest): Promise<VetRecommendationResponse> {
    const safetyWarnings: SafetyWarning[] = [];

    const safetyCheck = await this.performSafetyCheck(request);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        recommendation: null,
        safetyWarnings: safetyCheck.warnings,
        conflictResolution: null,
        disclaimer: VET_RECOMMENDATION_DISCLAIMER,
        isAssistiveOnly: true,
        requiresVetApproval: true,
      };
    }

    safetyWarnings.push(...safetyCheck.warnings);

    const query: RecommendationQuery = {
      genericId: request.genericId,
      genericCode: request.genericCode,
      query: request.query,
      species: request.species,
      region: request.region,
      organizationId: request.organizationId,
      customerId: request.customerId,
      userId: request.userId,
      sessionId: request.sessionId,
      limit: request.limit,
    };

    const rawRecommendation = await this.rankingEngine.rank(query);

    if (!rawRecommendation) {
      return {
        success: false,
        recommendation: null,
        safetyWarnings: [
          {
            code: 'NO_GENERIC_FOUND',
            severity: 'WARNING',
            message: 'No matching generic medicine found for the query',
          },
        ],
        conflictResolution: null,
        disclaimer: VET_RECOMMENDATION_DISCLAIMER,
        isAssistiveOnly: true,
        requiresVetApproval: false,
      };
    }

    // Apply governance rules to prevent commercial bias from overriding safety
    const biasPreventionService = getCommercialBiasPreventionService();
    const governanceResult = await biasPreventionService.applyGovernanceRules(
      rawRecommendation.rankedBrands,
      {
        genericCode: rawRecommendation.genericCode,
        species: request.species,
        userType: 'VET', // Assuming vet user for now
      }
    );

    // Update recommendation with governed rankings
    const recommendation = {
      ...rawRecommendation,
      rankedBrands: governanceResult.adjustedRanking,
    };

    // Add governance-related safety warnings
    if (governanceResult.biasAssessment.exceedsTransparencyThreshold) {
      safetyWarnings.push({
        code: 'COMMERCIAL_INFLUENCE_HIGH',
        severity: 'WARNING',
        message: `High commercial influence detected (${(governanceResult.biasAssessment.totalCommercialInfluence * 100).toFixed(1)}%). Rankings have been adjusted for safety.`,
      });
    }

    if (governanceResult.safetyAssessment.requiresVetApproval) {
      safetyWarnings.push({
        code: 'VET_APPROVAL_REQUIRED',
        severity: 'WARNING',
        message: 'Safety assessment indicates veterinary approval is required for this recommendation.',
      });
    }

    // Add governance actions as warnings
    for (const action of governanceResult.governanceActions) {
      if (action.action === 'SAFETY_OVERRIDE') {
        safetyWarnings.push({
          code: 'SAFETY_OVERRIDE_APPLIED',
          severity: 'INFO',
          message: `Safety override applied: ${action.reason}`,
        });
      }
    }

    let conflictResolution: ConflictResolutionResult | null = null;
    if (recommendation.rankedBrands.length > 0) {
      const activeContracts = await this.contractService.list({
        activeOnly: true,
        limit: 100,
      });

      conflictResolution = await this.conflictResolver.resolve({
        genericId: recommendation.genericId,
        brandId: recommendation.rankedBrands[0]?.brandId,
        organizationId: request.organizationId,
        region: request.region,
        activeContracts: activeContracts.items,
      });

      if (
        conflictResolution.winningRuleType === 'REGULATORY' &&
        conflictResolution.auditTrail.some((a) => a.reason.includes('BANNED'))
      ) {
        safetyWarnings.push({
          code: 'REGULATORY_BLOCK',
          severity: 'CRITICAL',
          message: 'This substance is banned and cannot be recommended',
          action: 'Consult regulatory guidelines',
        });
      }
    }

    if (recommendation.explainability.sponsorInfluencePresent) {
      safetyWarnings.push({
        code: 'SPONSOR_INFLUENCE',
        severity: 'INFO',
        message: 'Sponsor influence is present in the ranking. Review sponsor factors for transparency.',
      });
    }

    const requiresVetApproval = await this.checkVetApprovalRequired(recommendation.genericId);

    return {
      success: true,
      recommendation,
      safetyWarnings,
      conflictResolution,
      disclaimer: VET_RECOMMENDATION_DISCLAIMER,
      isAssistiveOnly: true,
      requiresVetApproval,
    };
  }

  private async performSafetyCheck(request: VetRecommendationRequest): Promise<{
    allowed: boolean;
    warnings: SafetyWarning[];
  }> {
    const warnings: SafetyWarning[] = [];

    if (request.genericId || request.genericCode) {
      const genericId = request.genericId;
      const genericCode = request.genericCode;

      let generic = null;
      try {
        if (genericId) {
          generic = await this.genericRegistry.getById(genericId);
        } else if (genericCode) {
          generic = await this.genericRegistry.findByCode(genericCode);
        }
      } catch {
        // Generic not found - will be handled later
      }

      if (generic) {
        if (generic.bannedSubstance) {
          warnings.push({
            code: 'BANNED_SUBSTANCE',
            severity: 'CRITICAL',
            message: 'This substance is banned and cannot be recommended',
            action: 'Select an alternative generic',
          });
          return { allowed: false, warnings };
        }

        if (generic.controlledSubstance) {
          warnings.push({
            code: 'CONTROLLED_SUBSTANCE',
            severity: 'WARNING',
            message: 'This is a controlled substance requiring special handling',
            action: 'Ensure proper documentation and vet authorization',
          });
        }

        if (generic.prescriptionRequired) {
          warnings.push({
            code: 'PRESCRIPTION_REQUIRED',
            severity: 'INFO',
            message: 'This medicine requires a prescription from a qualified veterinarian',
          });
        }
      }
    }

    return { allowed: true, warnings };
  }

  private async checkVetApprovalRequired(genericId: string): Promise<boolean> {
    try {
      const generic = await this.genericRegistry.getById(genericId);
      return generic.prescriptionRequired || generic.controlledSubstance;
    } catch {
      return true;
    }
  }

  async getSafetyReport(genericId: string): Promise<{
    genericId: string;
    isBanned: boolean;
    isControlled: boolean;
    requiresPrescription: boolean;
    warnings: SafetyWarning[];
    recommendations: string[];
  }> {
    const warnings: SafetyWarning[] = [];
    const recommendations: string[] = [];

    let generic = null;
    try {
      generic = await this.genericRegistry.getById(genericId);
    } catch {
      return {
        genericId,
        isBanned: false,
        isControlled: false,
        requiresPrescription: true,
        warnings: [
          {
            code: 'GENERIC_NOT_FOUND',
            severity: 'WARNING',
            message: 'Generic medicine not found in registry',
          },
        ],
        recommendations: ['Verify the generic ID and try again'],
      };
    }

    if (generic.bannedSubstance) {
      warnings.push({
        code: 'BANNED_SUBSTANCE',
        severity: 'CRITICAL',
        message: 'This substance is banned for veterinary use',
      });
      recommendations.push('Do not use this substance');
      recommendations.push('Consult regulatory guidelines for alternatives');
    }

    if (generic.controlledSubstance) {
      warnings.push({
        code: 'CONTROLLED_SUBSTANCE',
        severity: 'WARNING',
        message: 'This is a controlled substance',
      });
      recommendations.push('Maintain proper documentation');
      recommendations.push('Ensure secure storage');
      recommendations.push('Follow disposal guidelines');
    }

    if (generic.prescriptionRequired) {
      warnings.push({
        code: 'PRESCRIPTION_REQUIRED',
        severity: 'INFO',
        message: 'Veterinary prescription required',
      });
      recommendations.push('Obtain prescription from qualified veterinarian');
    }

    if (generic.defaultWithdrawalMeatDays || generic.defaultWithdrawalMilkDays) {
      warnings.push({
        code: 'WITHDRAWAL_PERIOD',
        severity: 'INFO',
        message: `Withdrawal periods apply: Meat: ${generic.defaultWithdrawalMeatDays ?? 'N/A'} days, Milk: ${generic.defaultWithdrawalMilkDays ?? 'N/A'} days`,
      });
      recommendations.push('Observe withdrawal periods before slaughter or milk use');
    }

    return {
      genericId,
      isBanned: generic.bannedSubstance,
      isControlled: generic.controlledSubstance,
      requiresPrescription: generic.prescriptionRequired,
      warnings,
      recommendations,
    };
  }
}

let service: VetRecommendationService | null = null;

export function getVetRecommendationService(): VetRecommendationService {
  if (!service) service = new VetRecommendationService();
  return service;
}

export function resetVetRecommendationServiceForTests(): void {
  service = null;
}
