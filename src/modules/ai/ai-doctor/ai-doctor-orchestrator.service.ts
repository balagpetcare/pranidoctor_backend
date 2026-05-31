import { AiMessageRole } from '../../../generated/prisma/index.js';
import { getAiVeterinaryRepository } from '../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import {
  containsDiagnosisLanguage,
  sanitizeAssistantOutput,
} from '../../ai-veterinary-core/safety/ai-safety.guardrails.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval/knowledge-retrieval.service.js';
import { buildEnrichedPromptContext } from '../knowledge-retrieval/grounding/grounding-engine.js';
import { validateLlmOutput } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

import {
  AI_DOCTOR_FEATURE,
  AI_DOCTOR_RETRIEVAL_PROFILE,
  AI_DOCTOR_TASK_TYPE,
} from './ai-doctor.constants.js';
import type {
  AiDoctorCase,
  AnalyzeCaseResult,
  CreateAiDoctorCaseInput,
  SubmitIntakeInput,
} from './ai-doctor.types.js';
import { getAiDoctorSessionEngine } from './engines/ai-doctor-session.engine.js';
import {
  buildClarificationPlan,
  buildRetrievalQuery,
  buildSymptomSnapshot,
  computeSymptomCompleteness,
  meetsDegradedCompletenessGate,
  meetsLlmCompletenessGate,
  validateFreeTextSymptoms,
  validateSymptomCodes,
  assertIntakeHasSymptoms,
} from './engines/symptom-intake.engine.js';
import {
  assessCaseRisk,
  shouldSkipLlmForEmergency,
} from './engines/emergency-detection.engine.js';
import {
  allDifferentialsHaveCitations,
  formatDifferentialSummary,
  fuseDifferentials,
  isTreatmentIntentQuery,
  loadGraphDifferentials,
} from './engines/differential-diagnosis.engine.js';
import {
  citationCoverage,
  computeCaseConfidence,
  confidenceBadgeLabel,
  shouldFailClosed,
  shouldRecommendEscalation,
} from './engines/confidence.engine.js';
import { getVetEscalationEngine } from './engines/vet-escalation.engine.js';

function blockedContent(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'এই প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত পশু চিকিৎসা তথ্য নেই। সম্ভাব্য কারণগুলো শুধুমাত্র যাচাইকৃত সূত্র থেকে দেখানো যায়। অনুগ্রহ করে লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
    : 'Insufficient verified veterinary knowledge to answer safely. Possible causes are shown only from verified sources. Please contact a licensed veterinarian.';
}

function emergencyContent(risk: AnalyzeCaseResult['riskAssessment'], locale: 'bn' | 'en'): string {
  const header =
    locale === 'bn'
      ? '⚠️ জরুরি: এখনই পশু চিকিৎসকের সাথে যোগাযোগ করুন।\n\n'
      : '⚠️ EMERGENCY: Contact a veterinarian immediately.\n\n';
  const body = locale === 'bn' ? risk.recommendationBn : risk.recommendationEn;
  return header + body;
}

export class AiDoctorOrchestratorService {
  readonly name = 'AiDoctorOrchestratorService';

  async createCase(input: CreateAiDoctorCaseInput): Promise<AiDoctorCase> {
    return getAiDoctorSessionEngine().createCase(input);
  }

  async getCase(caseId: string, userId: string): Promise<AiDoctorCase> {
    return getAiDoctorSessionEngine().loadCase(caseId, userId);
  }

  async submitIntake(
    caseId: string,
    userId: string,
    intake: SubmitIntakeInput,
  ): Promise<AnalyzeCaseResult> {
    const sessionEngine = getAiDoctorSessionEngine();
    let aiCase = await sessionEngine.loadCase(caseId, userId);

    validateFreeTextSymptoms(intake.freeTextSymptoms, aiCase.locale);
    await validateSymptomCodes(intake.symptomCodes, aiCase.species);

    const snapshot = buildSymptomSnapshot(
      omitUndefined({
        symptomCodes: intake.symptomCodes,
        freeTextSymptoms: intake.freeTextSymptoms,
        durationDays: intake.durationDays,
        severity: intake.severity,
        locale: aiCase.locale,
      }),
    );
    assertIntakeHasSymptoms(snapshot);

    const intakeQuery = buildRetrievalQuery(snapshot, aiCase.locale);
    if (isTreatmentIntentQuery(intakeQuery)) {
      return this.failClosedResult(
        sessionEngine.applyIntake(aiCase, snapshot, computeSymptomCompleteness(snapshot)),
        await assessCaseRisk({ snapshot, species: aiCase.species, locale: aiCase.locale }),
        computeSymptomCompleteness(snapshot),
        'TREATMENT_INTENT',
      );
    }

    let completeness = computeSymptomCompleteness(snapshot);
    const risk = await assessCaseRisk({
      snapshot,
      species: aiCase.species,
      locale: aiCase.locale,
    });
    completeness = { ...completeness, redFlagScreened: true };

    aiCase = sessionEngine.applyIntake(aiCase, snapshot, completeness);
    aiCase.riskAssessment = risk;

    if (shouldSkipLlmForEmergency(risk)) {
      aiCase = sessionEngine.transitionState(aiCase, 'EMERGENCY_TRIAGE');
      await sessionEngine.updateCase(aiCase);
      await getAiAuditService().write(
        omitUndefined({
          userId: aiCase.userId,
          sessionId: aiCase.sessionId,
          action: 'AI_DOCTOR_TRIAGE_RED_FLAG',
          detailJson: { caseId: aiCase.id, urgencyTier: risk.urgencyTier, redFlagCount: risk.redFlags.length },
        }),
      );
      return this.buildEmergencyResult(aiCase, risk);
    }

    if (!meetsLlmCompletenessGate(completeness)) {
      aiCase = sessionEngine.transitionState(aiCase, 'AWAITING_CLARIFICATION');
      await sessionEngine.updateCase(aiCase);
      const confidence = computeCaseConfidence({ differentials: [], completeness });
      return {
        case: aiCase,
        refused: false,
        content:
          aiCase.locale === 'bn'
            ? 'আরও কিছু তথ্য দরকার। নিচের প্রশ্নগুলোর উত্তর দিন।'
            : 'We need a bit more information. Please answer the questions below.',
        differentials: [],
        confidence,
        riskAssessment: risk,
        clarificationQuestions: buildClarificationPlan(completeness, aiCase.locale),
        humanRedirect: false,
        escalationRecommended: false,
        disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
      };
    }

    await sessionEngine.updateCase(aiCase);
    return this.analyze(caseId, userId);
  }

  async analyze(caseId: string, userId: string): Promise<AnalyzeCaseResult> {
    const sessionEngine = getAiDoctorSessionEngine();
    let aiCase = await sessionEngine.loadCase(caseId, userId);
    const snapshot = aiCase.symptomSnapshot;
    const completeness = aiCase.completeness;

    const risk =
      aiCase.riskAssessment ??
      (await assessCaseRisk({ snapshot, species: aiCase.species, locale: aiCase.locale }));

    if (shouldSkipLlmForEmergency(risk)) {
      aiCase = sessionEngine.transitionState(aiCase, 'EMERGENCY_TRIAGE');
      aiCase.riskAssessment = risk;
      await sessionEngine.updateCase(aiCase);
      return this.buildEmergencyResult(aiCase, risk);
    }

    if (!meetsDegradedCompletenessGate(completeness)) {
      const confidence = computeCaseConfidence({ differentials: [], completeness });
      return {
        case: aiCase,
        refused: true,
        content: blockedContent(aiCase.locale),
        differentials: [],
        confidence,
        riskAssessment: risk,
        clarificationQuestions: buildClarificationPlan(completeness, aiCase.locale),
        humanRedirect: true,
        escalationRecommended: true,
        disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
      };
    }

    const query = buildRetrievalQuery(snapshot, aiCase.locale);
    if (isTreatmentIntentQuery(query)) {
      return this.failClosedResult(aiCase, risk, completeness, 'TREATMENT_INTENT');
    }

    let differentialsFromDie: AnalyzeCaseResult['differentials'] | undefined;
    try {
      const { getDifferentialDiagnosisService } = await import(
        '../disease-intelligence/differential/differential-diagnosis.service.js'
      );
      const dieResult = await getDifferentialDiagnosisService().compute({
        symptomCodes: snapshot.symptomCodes,
        species: aiCase.species,
        locale: aiCase.locale,
        caseId,
        persona: 'farmer',
      });
      differentialsFromDie = dieResult.differentials;
    } catch {
      differentialsFromDie = undefined;
    }

    const graphRows = await loadGraphDifferentials({
      symptomCodes: snapshot.symptomCodes,
      species: aiCase.species,
    });

    const pack = await getKnowledgeRetrievalService().retrieve({
      query,
      locale: aiCase.locale,
      taskType: AI_DOCTOR_TASK_TYPE,
      feature: AI_DOCTOR_FEATURE,
      profileId: AI_DOCTOR_RETRIEVAL_PROFILE,
      species: aiCase.species,
    });

    const differentials =
      differentialsFromDie && differentialsFromDie.length > 0
        ? differentialsFromDie
        : fuseDifferentials({
            graphRows,
            pack,
            locale: aiCase.locale,
          });

    const confidence = computeCaseConfidence({ pack, differentials, completeness });
    const hasCitations =
      differentials.length > 0 &&
      allDifferentialsHaveCitations(differentials) &&
      (pack.chunks.length === 0 || citationCoverage(pack) > 0);
    const routingAction = pack.routingDecision.action;

    const failClosed = shouldFailClosed({
      confidence,
      routingAction,
      hasGroundedCitations: hasCitations,
    });

    if (failClosed || routingAction === 'BLOCK') {
      return this.failClosedResult(aiCase, risk, completeness, 'LOW_CONFIDENCE_OR_BLOCK', pack, differentials, confidence);
    }

    if (pack.chunks.length === 0 && differentials.length > 0) {
      const summary = formatDifferentialSummary(differentials, aiCase.locale);
      aiCase.differentials = differentials;
      aiCase.confidence = confidence;
      aiCase.lastPackId = pack.packId;
      aiCase = sessionEngine.transitionState(aiCase, 'RESPONSE_DELIVERED');
      await sessionEngine.updateCase(aiCase);
      return {
        case: aiCase,
        refused: false,
        content: summary,
        differentials,
        confidence,
        riskAssessment: risk,
        humanRedirect: true,
        escalationRecommended: true,
        pack,
        disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
      };
    }

    if (!meetsLlmCompletenessGate(completeness)) {
      const summary = formatDifferentialSummary(differentials, aiCase.locale);
      aiCase.differentials = differentials;
      aiCase.confidence = confidence;
      aiCase.lastPackId = pack.packId;
      aiCase = sessionEngine.transitionState(aiCase, 'RESPONSE_DELIVERED');
      await sessionEngine.updateCase(aiCase);
      return {
        case: aiCase,
        refused: false,
        content: summary,
        differentials,
        confidence,
        riskAssessment: risk,
        humanRedirect: shouldRecommendEscalation(confidence),
        escalationRecommended: shouldRecommendEscalation(confidence),
        pack,
        disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
      };
    }

    const enrichedContext = buildEnrichedPromptContext(pack);
    const diffSummary = formatDifferentialSummary(differentials, aiCase.locale);
    const badge = confidenceBadgeLabel(confidence.tier, aiCase.locale);
    const userMessage = [
      `Case symptoms: ${query}`,
      diffSummary,
      enrichedContext,
      aiCase.locale === 'bn'
        ? 'শিক্ষামূলক সারসংক্ষেপ দিন। নির্ণয় নিশ্চিত করবেন না। প্রতিটি দাবির জন্য সূত্র উল্লেখ করুন।'
        : 'Provide an educational summary. Do not confirm diagnosis. Cite sources for every claim.',
    ].join('\n\n');

    const llm = await getAiFoundationService().executePromptTask(
      omitUndefined({
        promptKey: 'ai_doctor',
        userMessage,
        locale: aiCase.locale,
        feature: AI_DOCTOR_FEATURE,
        taskType: AI_DOCTOR_TASK_TYPE,
        userId: aiCase.userId,
        customerId: aiCase.customerId,
        sessionId: aiCase.sessionId,
      }),
    );

    const validation = validateLlmOutput({
      llmOutput: llm.content,
      pack,
      taskType: AI_DOCTOR_TASK_TYPE,
    });

    let content: string;
    let refused = false;

    if (validation.action === 'BLOCK' || containsDiagnosisLanguage(llm.content)) {
      refused = true;
      content = `${formatDifferentialSummary(differentials, aiCase.locale)}\n\n${blockedContent(aiCase.locale)}`;
    } else if (validation.action === 'SANITIZE' && validation.sanitizedOutput) {
      content = sanitizeAssistantOutput(validation.sanitizedOutput);
    } else {
      content = sanitizeAssistantOutput(llm.content);
    }

    if (pack.citationBlock.trim()) {
      content = `${content}\n\n${pack.citationBlock}`;
    }

    content = `[${badge}]\n\n${content}`;

    await this.persistTurn(aiCase, query, content, refused, pack.packId);

    aiCase.differentials = differentials;
    aiCase.confidence = confidence;
    aiCase.riskAssessment = risk;
    aiCase.lastPackId = pack.packId;
    aiCase = sessionEngine.transitionState(aiCase, refused ? 'BLOCKED' : 'RESPONSE_DELIVERED');
    await sessionEngine.updateCase(aiCase);

    await getAiAuditService().write(
      omitUndefined({
        userId: aiCase.userId,
        sessionId: aiCase.sessionId,
        action: 'AI_DOCTOR_ANALYZE',
        detailJson: {
          caseId: aiCase.id,
          packId: pack.packId,
          routingDecision: routingAction,
          confidence: confidence.caseScore,
          differentialCount: differentials.length,
          refused,
        },
      }),
    );

    const humanRedirect =
      refused || shouldRecommendEscalation(confidence) || routingAction === 'PROCEED_DEGRADED';

    return {
      case: aiCase,
      refused,
      content,
      differentials,
      confidence,
      riskAssessment: risk,
      humanRedirect,
      escalationRecommended: humanRedirect,
      pack,
      disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
    };
  }

  async escalate(caseId: string, userId: string): Promise<{ case: AiDoctorCase; escalationId: string }> {
    const sessionEngine = getAiDoctorSessionEngine();
    const aiCase = await sessionEngine.loadCase(caseId, userId);
    const risk = aiCase.riskAssessment ?? {
      urgencyTier: 'MEDIUM' as const,
      triageBucket: 'MEDIUM' as const,
      urgencyLevel: 5,
      redFlags: [],
      recommendationBn: '',
      recommendationEn: '',
      escalationRequired: true,
      emergency: false,
    };

    const { escalationId } = await getVetEscalationEngine().createEscalation(
      omitUndefined({
        userId,
        sessionId: aiCase.sessionId,
        caseId: aiCase.id,
        triggerRuleId: 'USER_REQUESTED_VET',
        context: {
          urgencyTier: risk.urgencyTier,
          routingAction: 'ESCALATE',
          caseConfidence: aiCase.confidence?.caseScore ?? 0,
          userRequested: true,
          emergency: risk.emergency,
        },
      }),
    );

    const updated = sessionEngine.transitionState(
      { ...aiCase, escalationIds: [...aiCase.escalationIds, escalationId] },
      'ESCALATED',
    );
    await sessionEngine.updateCase(updated);

    return { case: updated, escalationId };
  }

  private async buildEmergencyResult(
    aiCase: AiDoctorCase,
    risk: AnalyzeCaseResult['riskAssessment'],
  ): Promise<AnalyzeCaseResult> {
    const escalation = await getVetEscalationEngine().createEscalation(
      omitUndefined({
        userId: aiCase.userId,
        sessionId: aiCase.sessionId,
        caseId: aiCase.id,
        triggerRuleId: 'RED_FLAG_SYMPTOM',
        context: {
          urgencyTier: risk.urgencyTier,
          routingAction: 'BLOCK',
          caseConfidence: 0,
          emergency: true,
        },
      }),
    );

    aiCase.escalationIds = [...aiCase.escalationIds, escalation.escalationId];
    await getAiDoctorSessionEngine().updateCase(aiCase);

    const confidence = computeCaseConfidence({
      differentials: [],
      completeness: aiCase.completeness,
    });

    return {
      case: aiCase,
      refused: true,
      content: emergencyContent(risk, aiCase.locale),
      differentials: [],
      confidence,
      riskAssessment: risk,
      emergencyHandoff: true,
      humanRedirect: true,
      escalationRecommended: true,
      disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
    };
  }

  private async failClosedResult(
    aiCase: AiDoctorCase,
    risk: AnalyzeCaseResult['riskAssessment'],
    completeness: AiDoctorCase['completeness'],
    trigger: string,
    pack?: AnalyzeCaseResult['pack'],
    differentials: AnalyzeCaseResult['differentials'] = [],
    confidence?: AnalyzeCaseResult['confidence'],
  ): Promise<AnalyzeCaseResult> {
    const conf =
      confidence ??
      computeCaseConfidence(
        omitUndefined({
          ...(pack !== undefined ? { pack } : {}),
          differentials,
          completeness,
        }),
      );

    const escalation = await getVetEscalationEngine().createEscalation(
      omitUndefined({
        userId: aiCase.userId,
        sessionId: aiCase.sessionId,
        caseId: aiCase.id,
        triggerRuleId: trigger,
        context: {
          urgencyTier: risk.urgencyTier,
          routingAction: pack?.routingDecision.action ?? 'BLOCK',
          caseConfidence: conf.caseScore,
          emergency: risk.emergency,
          policyRefusal: trigger === 'TREATMENT_INTENT',
        },
      }),
    );

    const sessionEngine = getAiDoctorSessionEngine();
    let updated = sessionEngine.transitionState(aiCase, 'BLOCKED');
    updated = {
      ...updated,
      escalationIds: [...updated.escalationIds, escalation.escalationId],
      differentials,
      confidence: conf,
    };
    await sessionEngine.updateCase(updated);

    await getAiAuditService().write(
      omitUndefined({
        userId: aiCase.userId,
        sessionId: aiCase.sessionId,
        action: 'AI_DOCTOR_FAIL_CLOSED',
        detailJson: { caseId: aiCase.id, trigger, caseScore: conf.caseScore },
      }),
    );

    const diffBlock =
      differentials.length > 0
        ? `\n\n${formatDifferentialSummary(differentials, aiCase.locale)}`
        : '';

    return {
      case: updated,
      refused: true,
      content: blockedContent(aiCase.locale) + diffBlock,
      differentials,
      confidence: conf,
      riskAssessment: risk,
      humanRedirect: true,
      escalationRecommended: true,
      ...(pack ? { pack } : {}),
      disclaimer: await resolveAiResponseDisclaimer('advisory', aiCase.locale),
    };
  }

  private async persistTurn(
    aiCase: AiDoctorCase,
    userContent: string,
    assistantContent: string,
    refused: boolean,
    packId: string,
  ): Promise<void> {
    const repo = getAiVeterinaryRepository();
    if (!aiCase.sessionId) return;

    await repo.addMessage({
      sessionId: aiCase.sessionId,
      role: AiMessageRole.USER,
      content: userContent.trim(),
      locale: aiCase.locale,
      inputJson: { caseId: aiCase.id, assistantId: 'ai-doctor' },
    });

    await repo.addMessage({
      sessionId: aiCase.sessionId,
      role: AiMessageRole.ASSISTANT,
      content: assistantContent,
      locale: aiCase.locale,
      refused,
      outputJson: { caseId: aiCase.id, packId, assistantId: 'ai-doctor' },
    });
  }
}

let service: AiDoctorOrchestratorService | null = null;

export function getAiDoctorOrchestratorService(): AiDoctorOrchestratorService {
  if (!service) service = new AiDoctorOrchestratorService();
  return service;
}

export function resetAiDoctorOrchestratorForTests(): void {
  service = null;
}
