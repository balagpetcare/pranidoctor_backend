import type { DiCaseSessionState, DiSafetyDecisionAction } from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getAiDoctorOrchestratorService } from '../../ai-doctor/ai-doctor-orchestrator.service.js';
import { assessCaseRisk } from '../../ai-doctor/engines/emergency-detection.engine.js';
import type {
  AnalyzeCaseResult,
  CreateAiDoctorCaseInput,
  SubmitIntakeInput,
} from '../../ai-doctor/ai-doctor.types.js';
import {
  assertAiLlmExecutionAllowed,
  shouldUseRulesOnlyForFeature,
} from '../../governance/ai-governance.enforcement.js';
import { getClinicalSafetyEngine } from '../safety/clinical-safety.engine.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';
import {
  DISEASE_INTELLIGENCE_FEATURE,
  DIE_RETRIEVAL_PROFILES,
} from '../disease-intelligence.constants.js';

/**
 * D8 — Disease reasoning facade over AI Doctor with DIE safety, analytics, and case persistence.
 */
export class DiseaseReasoningOrchestratorService {
  readonly name = 'DiseaseReasoningOrchestratorService';

  async createCase(input: CreateAiDoctorCaseInput) {
    const doctorCase = await getAiDoctorOrchestratorService().createCase(input);
    await getDiseaseIntelligenceRepository().createCaseSession(
      omitUndefined({
        id: doctorCase.id,
        userId: input.userId,
        customerId: input.customerId,
        livestockId: input.livestockId,
        species: input.species,
        locale: input.locale ?? 'bn',
        state: 'CREATED' as DiCaseSessionState,
        sessionId: doctorCase.sessionId,
        legacyMemoryKey: doctorCase.id,
        contextJson: { aiDoctorCaseId: doctorCase.id },
      }),
    );
    void getDiseaseAnalyticsService().track('CASE_CREATED', { caseId: doctorCase.id });
    return doctorCase;
  }

  async getCase(caseId: string, userId: string) {
    return getAiDoctorOrchestratorService().getCase(caseId, userId);
  }

  async submitIntake(caseId: string, userId: string, intake: SubmitIntakeInput): Promise<AnalyzeCaseResult> {
    return getAiDoctorOrchestratorService().submitIntake(caseId, userId, intake);
  }

  async analyze(caseId: string, userId: string, persona?: string): Promise<AnalyzeCaseResult> {
    const aiCase = await getAiDoctorOrchestratorService().getCase(caseId, userId);
    const snapshot = aiCase.symptomSnapshot;
    const query = snapshot
      ? [...snapshot.symptomCodes, ...(snapshot.freeTextSymptoms ?? [])].join(' ')
      : '';

    const safetyPre = await getClinicalSafetyEngine().evaluate({
      queryText: query,
      locale: aiCase.locale,
      caseId,
    });
    assertAiLlmExecutionAllowed(DISEASE_INTELLIGENCE_FEATURE);
    if (shouldUseRulesOnlyForFeature(DISEASE_INTELLIGENCE_FEATURE)) {
      return {
        case: aiCase,
        refused: true,
        content:
          aiCase.locale === 'bn'
            ? 'রোগ বিশ্লেষণ সেবা সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন বা ভেটেরিনারিয়ানের সাথে যোগাযোগ করুন।'
            : 'Disease analysis is temporarily unavailable. Please try again later or contact a veterinarian.',
        differentials: [],
        confidence: {
          retrievalAvg: 0,
          differentialTop: 0,
          caseScore: 0,
          tier: 'INSUFFICIENT',
          failClosed: true,
        },
        humanRedirect: true,
        escalationRecommended: true,
        disclaimer:
          aiCase.locale === 'bn'
            ? 'এটি চিকিৎসা পরামর্শ নয়।'
            : 'This is not medical advice.',
      };
    }

    if (safetyPre.blockLlm) {
      const risk =
        aiCase.riskAssessment ??
        (snapshot
          ? await assessCaseRisk({
              snapshot,
              species: aiCase.species,
              locale: aiCase.locale,
            })
          : undefined);
      return {
        case: aiCase,
        refused: true,
        content: safetyPre.messages[aiCase.locale],
        differentials: [],
        confidence: {
          retrievalAvg: 0,
          differentialTop: 0,
          caseScore: 0,
          tier: 'INSUFFICIENT',
          failClosed: true,
        },
        riskAssessment: risk ?? {
          urgencyTier: 'MEDIUM',
          triageBucket: 'MEDIUM',
          urgencyLevel: 2,
          redFlags: [],
          recommendationBn: safetyPre.messages.bn,
          recommendationEn: safetyPre.messages.en,
          escalationRequired: true,
          emergency: false,
        },
        humanRedirect: true,
        escalationRecommended: true,
        disclaimer: safetyPre.messages[aiCase.locale],
      };
    }

    const result = await getAiDoctorOrchestratorService().analyze(caseId, userId);

    if (result.content && !result.refused) {
      const safetyPost = await getClinicalSafetyEngine().evaluate({
        queryText: query,
        locale: aiCase.locale,
        caseId,
        postLlm: true,
        llmOutput: result.content,
        diseaseSlugs: result.differentials.map((d) => d.slug),
        routingBlocked: result.refused,
      });
      if (safetyPost.blockLlm) {
        result.refused = true;
        result.content = safetyPost.messages[aiCase.locale];
        result.humanRedirect = true;
        result.escalationRecommended = true;
      }
    }

    const diCase = await getDiseaseIntelligenceRepository().getCaseSession(caseId, userId);
    if (diCase) {
      const turnIndex = diCase.turns.length;
      await getDiseaseIntelligenceRepository().appendCaseTurn(
        omitUndefined({
          caseId: diCase.id,
          turnIndex,
          retrievalPackId: result.pack?.packId,
          outputJson: { differentials: result.differentials, refused: result.refused },
          safetyAction: (result.refused ? 'BLOCK' : 'PROCEED') as DiSafetyDecisionAction,
        }),
      );
      await getDiseaseIntelligenceRepository().updateCaseSession(diCase.id, {
        state: mapDoctorState(result.case.state),
        ...(snapshot ? { symptomsJson: snapshot as object } : {}),
      });
    }

    void getDiseaseAnalyticsService().track('CASE_ANALYZE', {
      caseId,
      metadata: { refused: result.refused, profile: DIE_RETRIEVAL_PROFILES.DISEASE },
    });

    return result;
  }

  async escalate(caseId: string, userId: string) {
    return getAiDoctorOrchestratorService().escalate(caseId, userId);
  }

  async migrateLegacyGraph() {
    return getDiseaseIntelligenceRepository().migrateSymptomGraphFromLegacy();
  }
}

function mapDoctorState(state: string): DiCaseSessionState {
  const map: Record<string, DiCaseSessionState> = {
    CREATED: 'CREATED',
    INTAKE: 'INTAKE',
    AWAITING_CLARIFICATION: 'AWAITING_CLARIFICATION',
    ANALYZING: 'ANALYZING',
    EMERGENCY_TRIAGE: 'EMERGENCY_TRIAGE',
    COMPLETE: 'COMPLETE',
    ESCALATED: 'ESCALATED',
    ABANDONED: 'ABANDONED',
    RESPONSE_DELIVERED: 'COMPLETE',
  };
  return map[state] ?? 'ANALYZING';
}

let service: DiseaseReasoningOrchestratorService | undefined;

export function getDiseaseReasoningOrchestratorService(): DiseaseReasoningOrchestratorService {
  service ??= new DiseaseReasoningOrchestratorService();
  return service;
}
