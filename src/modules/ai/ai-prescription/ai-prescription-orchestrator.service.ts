import { AiMessageRole } from '../../../generated/prisma/index.js';
import { getAiVeterinaryRepository } from '../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval/knowledge-retrieval.service.js';
import { buildEnrichedPromptContext } from '../knowledge-retrieval/grounding/grounding-engine.js';
import { validateLlmOutput } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

import {
  PRESCRIPTION_FEATURE,
  PRESCRIPTION_RETRIEVAL_PROFILE,
  PRESCRIPTION_TASK_TYPE,
} from './ai-prescription.constants.js';
import type {
  AiPrescriptionSession,
  CreatePrescriptionSessionInput,
  InteractionCheckResult,
  MedicineLookupResult,
  PrescriptionAnalyzeInput,
  PrescriptionAnalyzeResult,
  WithdrawalLookupResult,
} from './ai-prescription.types.js';
import { getPrescriptionSessionEngine } from './engines/prescription-session.engine.js';
import { searchMedicines, loadMedicineBySlugs } from './engines/medicine-lookup.engine.js';
import { buildDrugReferenceCard } from './engines/species-eligibility.engine.js';
import { buildPrescriptionSafetyReport } from './engines/safety-report.engine.js';
import { analyzeDrugInteractions } from './engines/interaction.engine.js';
import { resolveWithdrawalSummaries } from './engines/withdrawal.engine.js';
import {
  computeSessionConfidence,
  confidenceBadgeLabel,
  formatSafetySummary,
  shouldRecommendEscalation,
  shouldSkipLlmForFarmerDoseRequest,
  shouldCreateEscalationRecord,
} from './engines/prescription-confidence.engine.js';
import { getPrescriptionEscalationEngine } from './engines/prescription-escalation.engine.js';
import { buildMedicineCitation } from './engines/medicine-metadata.util.js';
import { getPrescriptionIntegrationService } from '../medicine/vet-layer/prescription-integration.service.js';

function blockedContent(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'এই ওষুধ/মাত্রা সম্পর্কিত প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত তথ্য নেই। ওষুধের তথ্য শুধুমাত্র যাচাইকৃত সূত্র থেকে দেখানো যায়। অনুগ্রহ করে লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের পরামর্শ নিন।'
    : 'Insufficient verified knowledge for this medicine question. Drug facts are shown only from verified sources. Please consult a licensed veterinarian.';
}

function farmerDoseBlockedContent(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'মাত্রা/ডোজ সুপারিশ শুধুমাত্র পশুচিকিৎসক দিতে পারেন। নিচে যাচাইকৃত ওষুধের তথ্য দেখুন এবং ভেটের সাথে যোগাযোগ করুন।'
    : 'Dosage recommendations require a licensed veterinarian. See verified drug reference below and contact your vet.';
}

function formatStructuredFactsForDisplay(
  facts: PrescriptionAnalyzeResult['structuredFacts'],
  locale: 'bn' | 'en',
): string {
  if (facts.length === 0) return '';
  const header =
    locale === 'bn' ? 'যাচাইকৃত তথ্য (সূত্রসহ):' : 'Verified facts (with sources):';
  const lines = facts.map(
    (f) => `- ${f.factType}: ${f.value}${f.unit ? ` ${f.unit}` : ''} ${f.sourceCitation}`,
  );
  return [header, ...lines].join('\n');
}

export class AiPrescriptionOrchestratorService {
  readonly name = 'AiPrescriptionOrchestratorService';

  async createSession(input: CreatePrescriptionSessionInput): Promise<AiPrescriptionSession> {
    return getPrescriptionSessionEngine().createSession(input);
  }

  async getSession(sessionId: string, userId: string): Promise<AiPrescriptionSession> {
    return getPrescriptionSessionEngine().loadSession(sessionId, userId);
  }

  async lookupMedicine(params: {
    query: string;
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
  }): Promise<MedicineLookupResult> {
    const matches = await searchMedicines({
      query: params.query,
      species: params.species,
    });
    return { matches, query: params.query };
  }

  async checkInteractions(params: { drugSlugs: string[] }): Promise<InteractionCheckResult> {
    const entries = await loadMedicineBySlugs(params.drugSlugs);
    const bundle = analyzeDrugInteractions(entries);
    const citations = entries.map((e) => buildMedicineCitation(e));
    return {
      bundle,
      citations,
      safetyClassification: bundle.overallRisk,
    };
  }

  async lookupWithdrawal(params: {
    drugSlugs: string[];
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
  }): Promise<WithdrawalLookupResult> {
    const entries = await loadMedicineBySlugs(params.drugSlugs);
    const summaries = resolveWithdrawalSummaries(entries, params.species);
    const citations = summaries.flatMap((s) => s.periods.flatMap((p) => p.citations));
    const hasData = summaries.some((s) => s.periods.length > 0);
    return {
      summaries,
      citations,
      safetyClassification: hasData ? 'LOW' : 'MODERATE',
    };
  }

  async analyze(
    sessionId: string,
    userId: string,
    input: PrescriptionAnalyzeInput,
  ): Promise<PrescriptionAnalyzeResult> {
    const sessionEngine = getPrescriptionSessionEngine();
    let session = await sessionEngine.loadSession(sessionId, userId);
    session = sessionEngine.transitionState(session, 'ANALYZING');

    const query =
      input.message?.trim() ||
      input.query?.trim() ||
      (input.drugSlugs?.length ? input.drugSlugs.join(' ') : 'medicine reference');

    let drugSlugs = [...new Set([...session.drugSlugs, ...(input.drugSlugs ?? [])])];

    if ((input.query || input.message) && drugSlugs.length === 0) {
      const searchQ = input.query ?? input.message ?? '';
      const matches = await searchMedicines({ query: searchQ, species: session.species });
      drugSlugs = matches.map((m) => m.slug);
    }

    const vaccineSlugs = [...new Set([...session.vaccineSlugs, ...(input.vaccineSlugs ?? [])])];
    session.drugSlugs = drugSlugs;
    session.vaccineSlugs = vaccineSlugs;

    const medicineEntries = await loadMedicineBySlugs(drugSlugs);
    const drugMatches =
      medicineEntries.length > 0
        ? medicineEntries.map((entry) => ({
            entityId: entry.id,
            slug: entry.slug,
            genericName: entry.titleEn,
            brandNamesBd: [],
            prescriptionRequired: true,
            confidenceScore: entry.confidenceScore,
            citations: [buildMedicineCitation(entry)],
          }))
        : await searchMedicines({ query, species: session.species });

    const referenceCards = medicineEntries.map((e) => buildDrugReferenceCard(e));

    const pack = await getKnowledgeRetrievalService().retrieve({
      query,
      locale: session.locale,
      taskType: PRESCRIPTION_TASK_TYPE,
      feature: PRESCRIPTION_FEATURE,
      profileId: PRESCRIPTION_RETRIEVAL_PROFILE,
      species: session.species,
    });

    const safetyReport = await buildPrescriptionSafetyReport({
      entries: medicineEntries,
      species: session.species,
      locale: session.locale,
      mode: session.mode,
      pregnancy: session.pregnancy,
      lactating: session.lactating,
      vaccineSlugs,
      ...(session.ageDays !== undefined ? { ageDays: session.ageDays } : {}),
      pack,
    });

    const confidence = computeSessionConfidence({ pack, safetyReport });
    const routingBlocked = pack.routingDecision.action === 'BLOCK' || confidence.failClosed;
    const skipDoseLlm =
      input.message !== undefined &&
      shouldSkipLlmForFarmerDoseRequest({ message: input.message, mode: session.mode });

    const safetyBlock = formatSafetySummary(safetyReport, session.locale);
    const badge = confidenceBadgeLabel(confidence.tier, session.locale);
    const citationLines = safetyReport.citations.map((c) => c.token).join(' ');

    let content: string;
    let refused = false;
    let escalationId: string | undefined;
    let escalationType = safetyReport.escalationType;

    const humanRedirect =
      routingBlocked ||
      safetyReport.escalationRequired ||
      shouldRecommendEscalation(confidence) ||
      pack.routingDecision.action === 'PROCEED_DEGRADED';

    if (routingBlocked && medicineEntries.length === 0 && pack.structuredFacts.length === 0) {
      refused = true;
      content = [`[${badge}]`, blockedContent(session.locale), safetyBlock, citationLines]
        .filter(Boolean)
        .join('\n\n');
    } else if (skipDoseLlm) {
      refused = true;
      content = [
        `[${badge}]`,
        farmerDoseBlockedContent(session.locale),
        formatStructuredFactsForDisplay(pack.structuredFacts, session.locale),
        safetyBlock,
        pack.citationBlock,
        citationLines,
      ]
        .filter(Boolean)
        .join('\n\n');
    } else if (routingBlocked || safetyReport.overallRisk === 'CRITICAL') {
      refused = true;
      content = [
        `[${badge}]`,
        blockedContent(session.locale),
        safetyBlock,
        pack.citationBlock,
        citationLines,
      ]
        .filter(Boolean)
        .join('\n\n');
    } else {
      const enrichedContext = buildEnrichedPromptContext(pack);
      const modeContract =
        session.mode === 'FARMER_REFERENCE'
          ? session.locale === 'bn'
            ? 'কোনো প্রেসক্রিপশন, চিকিৎসা পরিকল্পনা বা মাত্রা সুপারিশ করবেন না। শুধু যাচাইকৃত ওষুধের তথ্য ও সতর্কতা দিন।'
            : 'Do NOT generate prescriptions, treatment plans, or dose recommendations. Provide verified drug reference and safety warnings only.'
          : session.locale === 'bn'
            ? 'ওষুধ যাচাইকরণ রিপোর্ট দিন — স্বয়ংক্রিয় প্রেসক্রিপশন তৈরি করবেন না।'
            : 'Provide drug validation report — do NOT autonomously generate prescriptions.';

      const userMessage = [
        enrichedContext,
        safetyBlock,
        modeContract,
        input.message ?? query,
      ].join('\n\n');

      const llm = await getAiFoundationService().executePromptTask(
        omitUndefined({
          promptKey: 'prescription_assistant',
          userMessage,
          locale: session.locale,
          feature: PRESCRIPTION_FEATURE,
          taskType: PRESCRIPTION_TASK_TYPE,
          userId: session.userId,
          customerId: session.customerId,
          sessionId: session.sessionId,
        }),
      );

      const validation = validateLlmOutput({
        llmOutput: llm.content,
        pack,
        taskType: PRESCRIPTION_TASK_TYPE,
      });

      if (validation.action === 'BLOCK') {
        refused = true;
        content = [
          `[${badge}]`,
          formatStructuredFactsForDisplay(pack.structuredFacts, session.locale),
          safetyBlock,
          blockedContent(session.locale),
          pack.citationBlock,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else if (validation.action === 'SANITIZE' && validation.sanitizedOutput) {
        content = `[${badge}]\n\n${validation.sanitizedOutput}`;
      } else {
        content = `[${badge}]\n\n${llm.content}`;
      }

      if (pack.citationBlock.trim()) {
        content = `${content}\n\n${pack.citationBlock}`;
      }
      content = `${content}\n\n${citationLines}`;
    }

    if (
      shouldCreateEscalationRecord({
        refused,
        routingBlocked,
        safetyReport,
      })
    ) {
      const esc = await getPrescriptionEscalationEngine().createEscalation(
        omitUndefined({
          userId,
          sessionId: session.sessionId,
          prescriptionSessionId: session.id,
          safetyReport,
          confidence,
          triggerRuleId: refused ? 'PRESCRIPTION_BLOCK' : 'SAFETY_ESCALATION',
          routingBlocked,
        }),
      );
      escalationId = esc.escalationId;
      escalationType = esc.escalationType;
      session.escalationIds.push(esc.escalationId);
    }

    await this.persistTurn(session, query, content, refused, pack.packId);

    session.lastPackId = pack.packId;
    session.lastSafetyReportId = safetyReport.reportId;
    session = sessionEngine.transitionState(session, refused ? 'BLOCKED' : 'RESPONSE_DELIVERED');
    await sessionEngine.updateSession(session);

    await getAiAuditService().write(
      omitUndefined({
        userId,
        sessionId: session.sessionId,
        action: 'PRESCRIPTION_ANALYZE',
        detailJson: {
          prescriptionSessionId: session.id,
          packId: pack.packId,
          routingDecision: pack.routingDecision.action,
          confidence: confidence.sessionScore,
          safetyClassification: safetyReport.safetyClassification,
          drugSlugs,
          refused,
          feature: PRESCRIPTION_FEATURE,
        },
      }),
    );

    return {
      session,
      refused,
      content,
      drugMatches,
      referenceCards,
      safetyReport,
      confidence,
      citations: safetyReport.citations,
      safetyClassification: safetyReport.safetyClassification,
      humanRedirect,
      escalationRecommended: humanRedirect,
      ...(escalationType !== undefined ? { escalationType } : {}),
      ...(escalationId !== undefined ? { escalationId } : {}),
      structuredFacts: pack.structuredFacts,
      pack,
      disclaimer: await resolveAiResponseDisclaimer('advisory', session.locale),
    };
  }

  /**
   * Get enhanced medicine recommendations using Medicine Intelligence
   */
  async getEnhancedMedicineRecommendation(params: {
    drugSlug?: string;
    genericCode?: string;
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
    region?: string;
    organizationId?: string;
    customerId?: string;
    userId?: string;
    sessionId?: string;
  }): Promise<{
    recommendation: import('../medicine/vet-layer/prescription-integration.service.js').MedicineRecommendationForPrescription;
    explainability: {
      rankingFactors: string[];
      safetyChecks: string[];
      commercialInfluence: {
        present: boolean;
        level: number;
        transparency: string[];
      };
    };
    integrationMetadata: {
      sourceSystem: 'MEDICINE_INTELLIGENCE';
      confidenceScore: number;
      safetyScore: number;
      recommendationVersion: string;
    };
  }> {
    const prescriptionIntegration = getPrescriptionIntegrationService();
    
    let recommendation;
    if (params.drugSlug) {
      recommendation = await prescriptionIntegration.getRecommendationsForDrugSlug(
        params.drugSlug,
        {
          species: params.species,
          region: params.region,
          organizationId: params.organizationId,
          customerId: params.customerId,
          userId: params.userId,
          sessionId: params.sessionId,
        }
      );
    } else if (params.genericCode) {
      recommendation = await prescriptionIntegration.getRecommendationsForGeneric(
        params.genericCode,
        {
          species: params.species,
          region: params.region,
          organizationId: params.organizationId,
          customerId: params.customerId,
          userId: params.userId,
          sessionId: params.sessionId,
        }
      );
    } else {
      throw new Error('Either drugSlug or genericCode must be provided');
    }

    // Build explainability information
    const explainability = {
      rankingFactors: recommendation.rankedBrands.flatMap(b => b.reasonCodes || []),
      safetyChecks: recommendation.safetyWarnings.map(w => w.message),
      commercialInfluence: {
        present: recommendation.rankedBrands.some(b => b.hasSponsorInfluence),
        level: recommendation.rankedBrands.length > 0 ? 
          (recommendation.rankedBrands.filter(b => b.hasSponsorInfluence).length / recommendation.rankedBrands.length) : 0,
        transparency: recommendation.rankedBrands
          .filter(b => b.hasSponsorInfluence)
          .map(b => `Brand ${b.nameEn} has sponsor influence`)
      },
    };

    // Calculate safety score based on warnings
    const criticalWarnings = recommendation.safetyWarnings.filter(w => w.severity === 'CRITICAL').length;
    const highWarnings = recommendation.safetyWarnings.filter(w => w.severity === 'HIGH').length;
    const safetyScore = Math.max(0, 1 - (criticalWarnings * 0.5) - (highWarnings * 0.2));

    return {
      recommendation,
      explainability,
      integrationMetadata: {
        sourceSystem: 'MEDICINE_INTELLIGENCE',
        confidenceScore: recommendation.confidence,
        safetyScore,
        recommendationVersion: '1.0',
      },
    };
  }

  async escalate(
    sessionId: string,
    userId: string,
  ): Promise<{ session: AiPrescriptionSession; escalationId: string; escalationType: string }> {
    const sessionEngine = getPrescriptionSessionEngine();
    const session = await sessionEngine.loadSession(sessionId, userId);

    const safetyReport = await buildPrescriptionSafetyReport({
      entries: await loadMedicineBySlugs(session.drugSlugs),
      species: session.species,
      locale: session.locale,
      mode: session.mode,
      pregnancy: session.pregnancy,
      lactating: session.lactating,
      vaccineSlugs: session.vaccineSlugs,
    });

    const confidence = computeSessionConfidence({ safetyReport });

    const { escalationId, escalationType } = await getPrescriptionEscalationEngine().createEscalation(
      omitUndefined({
        userId,
        sessionId: session.sessionId,
        prescriptionSessionId: session.id,
        safetyReport,
        confidence,
        triggerRuleId: 'USER_REQUESTED_VET',
        userRequested: true,
      }),
    );

    session.escalationIds.push(escalationId);
    const updated = sessionEngine.transitionState(session, 'ESCALATED');
    await sessionEngine.updateSession(updated);

    await getAiAuditService().write(
      omitUndefined({
        userId,
        sessionId: session.sessionId,
        action: 'PRESCRIPTION_ESCALATE',
        detailJson: {
          prescriptionSessionId: session.id,
          escalationId,
          escalationType,
        },
      }),
    );

    return { session: updated, escalationId, escalationType };
  }

  private async persistTurn(
    session: AiPrescriptionSession,
    userContent: string,
    assistantContent: string,
    refused: boolean,
    packId: string,
  ): Promise<void> {
    if (!session.sessionId) return;
    const repo = getAiVeterinaryRepository();
    await repo.addMessage({
      sessionId: session.sessionId,
      role: AiMessageRole.USER,
      content: userContent.trim(),
      locale: session.locale,
      inputJson: {
        prescriptionSessionId: session.id,
        packId,
      },
    });
    await repo.addMessage({
      sessionId: session.sessionId,
      role: AiMessageRole.ASSISTANT,
      content: assistantContent,
      locale: session.locale,
      refused,
      outputJson: {
        prescriptionSessionId: session.id,
        packId,
        refused,
      },
    });
  }
}

let service: AiPrescriptionOrchestratorService | null = null;

export function getAiPrescriptionOrchestratorService(): AiPrescriptionOrchestratorService {
  if (!service) service = new AiPrescriptionOrchestratorService();
  return service;
}

export function resetAiPrescriptionOrchestratorForTests(): void {
  service = null;
}
