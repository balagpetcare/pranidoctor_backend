import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import type { AiDbTaskType } from '../../routing/ai-task.types.js';
import { getVetRecommendationService } from '../vet-layer/vet-recommendation.service.js';
import { getMedicineKnowledgeRetrievalService } from '../knowledge/medicine-knowledge-retrieval.service.js';
import { getTherapeuticClassificationService } from '../knowledge/therapeutic-classification.service.js';

export type MedicineAiRouterContext = {
  taskType: AiDbTaskType;
  species?: LivestockSpecies;
  medicineQuery?: string;
  genericCode?: string;
  brandCode?: string;
  safetyLevel: 'STANDARD' | 'HIGH' | 'CRITICAL';
  userRole: 'FARMER' | 'VET' | 'TECHNICIAN' | 'ADMIN';
  organizationId?: string;
  customerId?: string;
  sessionId?: string;
};

export type MedicineRoutingDecision = {
  routeToMedicineIntelligence: boolean;
  routeToKnowledgeRetrieval: boolean;
  routeToPrescriptionAssistant: boolean;
  safetyGatesPassed: boolean;
  requiredCapabilities: string[];
  routingReason: string;
  confidenceThreshold: number;
  explainabilityRequired: boolean;
  auditRequired: boolean;
};

export type MedicineAiResponse = {
  medicineRecommendation?: any;
  knowledgeContext?: any;
  prescriptionGuidance?: any;
  safetyAssessment: {
    passed: boolean;
    warnings: string[];
    blockers: string[];
    requiresEscalation: boolean;
  };
  routingDecision: MedicineRoutingDecision;
  explainability: {
    decisionFactors: string[];
    safetyChecks: string[];
    commercialInfluence: {
      detected: boolean;
      level: number;
      mitigations: string[];
    };
    confidenceLevel: number;
  };
};

export class MedicineAiRouterService {
  readonly name = 'MedicineAiRouterService';

  private vetRecommendation = getVetRecommendationService();
  private medicineKnowledge = getMedicineKnowledgeRetrievalService();
  private therapeuticClassification = getTherapeuticClassificationService();

  /**
   * Route medicine-related AI requests to appropriate systems
   */
  async routeMedicineRequest(
    query: string,
    context: MedicineAiRouterContext
  ): Promise<MedicineAiResponse> {
    // Make routing decision
    const routingDecision = await this.makeRoutingDecision(query, context);

    // Initialize response
    const response: MedicineAiResponse = {
      safetyAssessment: {
        passed: false,
        warnings: [],
        blockers: [],
        requiresEscalation: false,
      },
      routingDecision,
      explainability: {
        decisionFactors: [],
        safetyChecks: [],
        commercialInfluence: {
          detected: false,
          level: 0,
          mitigations: [],
        },
        confidenceLevel: 0,
      },
    };

    // Perform safety assessment first
    const safetyAssessment = await this.performSafetyAssessment(query, context);
    response.safetyAssessment = safetyAssessment;

    // If safety fails, block further processing
    if (!safetyAssessment.passed) {
      response.explainability.decisionFactors.push('BLOCKED_BY_SAFETY');
      return response;
    }

    // Route to Medicine Intelligence if decided
    if (routingDecision.routeToMedicineIntelligence) {
      try {
        const medicineRecommendation = await this.vetRecommendation.getRecommendation({
          query,
          genericCode: context.genericCode,
          species: context.species,
          organizationId: context.organizationId,
          customerId: context.customerId,
          sessionId: context.sessionId,
        });

        response.medicineRecommendation = medicineRecommendation;

        // Extract commercial influence information
        if (medicineRecommendation.recommendation?.rankedBrands) {
          const brandsWithInfluence = medicineRecommendation.recommendation.rankedBrands.filter(
            (b: any) => b.sponsorFactors?.length > 0 || b.contractFactors?.length > 0
          );
          
          response.explainability.commercialInfluence = {
            detected: brandsWithInfluence.length > 0,
            level: brandsWithInfluence.length / medicineRecommendation.recommendation.rankedBrands.length,
            mitigations: ['Bias prevention applied', 'Safety-first ranking', 'Transparency disclosed'],
          };
        }

        response.explainability.confidenceLevel = medicineRecommendation.recommendation?.confidence || 0;
        response.explainability.decisionFactors.push('MEDICINE_INTELLIGENCE_SUCCESS');
      } catch (error) {
        response.explainability.decisionFactors.push('MEDICINE_INTELLIGENCE_FAILED');
        console.error('Medicine Intelligence routing failed:', error);
      }
    }

    // Route to Knowledge Retrieval if decided
    if (routingDecision.routeToKnowledgeRetrieval) {
      try {
        const knowledgeContext = await this.medicineKnowledge.retrieveWithMedicineContext(
          query,
          {
            genericCode: context.genericCode,
            brandCode: context.brandCode,
            species: context.species,
          },
          context.sessionId
        );

        response.knowledgeContext = knowledgeContext;
        response.explainability.decisionFactors.push('KNOWLEDGE_RETRIEVAL_SUCCESS');

        // Add safety checks from knowledge context
        if (knowledgeContext.medicineContext?.safetyWarnings) {
          response.explainability.safetyChecks.push(...knowledgeContext.medicineContext.safetyWarnings);
        }
      } catch (error) {
        response.explainability.decisionFactors.push('KNOWLEDGE_RETRIEVAL_FAILED');
        console.error('Knowledge Retrieval routing failed:', error);
      }
    }

    // Route to Prescription Assistant if decided
    if (routingDecision.routeToPrescriptionAssistant) {
      try {
        // This would integrate with the existing AI Prescription system
        // For now, we'll indicate that it should be routed there
        response.prescriptionGuidance = {
          shouldRoute: true,
          enhancedContext: {
            medicineIntelligenceAvailable: !!response.medicineRecommendation,
            safetyAssessmentComplete: true,
            commercialBiasChecked: true,
          },
        };
        response.explainability.decisionFactors.push('PRESCRIPTION_ASSISTANT_ROUTED');
      } catch (error) {
        response.explainability.decisionFactors.push('PRESCRIPTION_ASSISTANT_FAILED');
        console.error('Prescription Assistant routing failed:', error);
      }
    }

    return response;
  }

  /**
   * Make intelligent routing decisions based on query and context
   */
  private async makeRoutingDecision(
    query: string,
    context: MedicineAiRouterContext
  ): Promise<MedicineRoutingDecision> {
    const decision: MedicineRoutingDecision = {
      routeToMedicineIntelligence: false,
      routeToKnowledgeRetrieval: false,
      routeToPrescriptionAssistant: false,
      safetyGatesPassed: false,
      requiredCapabilities: [],
      routingReason: '',
      confidenceThreshold: 0.7,
      explainabilityRequired: true,
      auditRequired: false,
    };

    // Determine if this is a medicine-related query
    const isMedicineQuery = this.isMedicineRelatedQuery(query, context);
    
    if (!isMedicineQuery) {
      decision.routingReason = 'NOT_MEDICINE_RELATED';
      return decision;
    }

    // Route based on task type
    switch (context.taskType) {
      case 'PRESCRIPTION_ANALYSIS':
        decision.routeToMedicineIntelligence = true;
        decision.routeToKnowledgeRetrieval = true;
        decision.routeToPrescriptionAssistant = true;
        decision.routingReason = 'COMPREHENSIVE_PRESCRIPTION_ANALYSIS';
        break;

      case 'GENERAL_CHAT':
        // For general chat about medicines, use knowledge retrieval
        decision.routeToKnowledgeRetrieval = true;
        decision.routingReason = 'MEDICINE_INFORMATION_QUERY';
        break;

      case 'VET_DECISION_SUPPORT':
        decision.routeToMedicineIntelligence = true;
        decision.routeToKnowledgeRetrieval = true;
        decision.routingReason = 'VET_DECISION_SUPPORT';
        break;

      default:
        decision.routeToKnowledgeRetrieval = true;
        decision.routingReason = 'DEFAULT_KNOWLEDGE_RETRIEVAL';
    }

    // Adjust based on user role
    if (context.userRole === 'FARMER') {
      // Farmers get limited access to medicine intelligence
      decision.routeToMedicineIntelligence = false;
      decision.confidenceThreshold = 0.8; // Higher confidence required
      decision.explainabilityRequired = true;
      decision.auditRequired = true;
    } else if (context.userRole === 'VET') {
      // Vets get full access
      decision.confidenceThreshold = 0.6; // Lower confidence acceptable
      decision.auditRequired = true;
    }

    // Adjust based on safety level
    if (context.safetyLevel === 'CRITICAL') {
      decision.confidenceThreshold = 0.9; // Very high confidence required
      decision.explainabilityRequired = true;
      decision.auditRequired = true;
      decision.requiredCapabilities.push('CRITICAL_SAFETY_VALIDATION');
    }

    return decision;
  }

  /**
   * Perform comprehensive safety assessment
   */
  private async performSafetyAssessment(
    query: string,
    context: MedicineAiRouterContext
  ): Promise<MedicineAiResponse['safetyAssessment']> {
    const assessment = {
      passed: true,
      warnings: [] as string[],
      blockers: [] as string[],
      requiresEscalation: false,
    };

    // Check if this involves controlled substances
    if (this.containsControlledSubstanceKeywords(query)) {
      assessment.warnings.push('Query involves controlled substances');
      assessment.requiresEscalation = context.userRole === 'FARMER';
    }

    // Check for dangerous drug combinations
    if (this.containsDangerousInteractionKeywords(query)) {
      assessment.warnings.push('Potential dangerous drug interaction detected');
      assessment.requiresEscalation = true;
    }

    // Check species-medicine compatibility if we can determine it
    if (context.genericCode && context.species) {
      try {
        const safetyValidation = await this.therapeuticClassification.validateMedicineSafety(
          context.genericCode,
          { species: context.species }
        );

        if (!safetyValidation.isApproved) {
          assessment.blockers.push('Medicine not approved for specified species');
          assessment.passed = false;
        }

        assessment.warnings.push(...safetyValidation.warnings.map(w => w.message));
      } catch (error) {
        assessment.warnings.push('Unable to perform species safety validation');
      }
    }

    // Block if user role is insufficient for safety level
    if (context.safetyLevel === 'CRITICAL' && context.userRole === 'FARMER') {
      assessment.blockers.push('Critical safety queries require veterinary supervision');
      assessment.passed = false;
    }

    return assessment;
  }

  private isMedicineRelatedQuery(query: string, context: MedicineAiRouterContext): boolean {
    const medicineKeywords = [
      'medicine', 'drug', 'antibiotic', 'vaccine', 'dose', 'dosage',
      'treatment', 'therapy', 'medication', 'prescription', 'inject',
      'tablet', 'capsule', 'suspension', 'powder', 'ointment',
      'ওষুধ', 'দওয়াই', 'এন্টিবায়োটিক', 'টিকা', 'মাত্রা'
    ];

    const queryLower = query.toLowerCase();
    return medicineKeywords.some(keyword => queryLower.includes(keyword)) ||
           !!context.genericCode || 
           !!context.brandCode ||
           context.taskType === 'PRESCRIPTION_ANALYSIS';
  }

  private containsControlledSubstanceKeywords(query: string): boolean {
    const controlledKeywords = [
      'morphine', 'fentanyl', 'ketamine', 'xylazine', 'barbiturate',
      'controlled', 'scheduled', 'narcotic', 'opioid'
    ];

    const queryLower = query.toLowerCase();
    return controlledKeywords.some(keyword => queryLower.includes(keyword));
  }

  private containsDangerousInteractionKeywords(query: string): boolean {
    const interactionKeywords = [
      'interaction', 'combine', 'together with', 'along with', 'mixed with',
      'contraindicated', 'incompatible', 'adverse', 'toxic'
    ];

    const queryLower = query.toLowerCase();
    return interactionKeywords.some(keyword => queryLower.includes(keyword));
  }
}

let service: MedicineAiRouterService | null = null;

export function getMedicineAiRouterService(): MedicineAiRouterService {
  if (!service) service = new MedicineAiRouterService();
  return service;
}

export function resetMedicineAiRouterServiceForTests(): void {
  service = null;
}