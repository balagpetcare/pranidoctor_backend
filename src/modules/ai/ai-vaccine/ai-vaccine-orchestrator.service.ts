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
  VACCINE_FEATURE,
  VACCINE_RETRIEVAL_PROFILE,
  VACCINE_TASK_TYPE,
} from './ai-vaccine.constants.js';
import type {
  AiVaccineSession,
  BoosterCheckResult,
  CreateVaccineSessionInput,
  EligibilityCheckResult,
  EligibilityResult,
  MissedVaccineResult,
  ReminderRecommendationsResult,
  ScheduleRetrievalResult,
  VaccineAnalyzeInput,
  VaccineAnalyzeResult,
  VaccineInteractionCheckResult,
  VaccineLookupResult,
} from './ai-vaccine.types.js';
import { getVaccineSessionEngine } from './engines/vaccine-session.engine.js';
import { searchVaccines, loadVaccineBySlugs, buildVaccineReferenceCard } from './engines/vaccine-lookup.engine.js';
import { retrieveSpeciesSchedules } from './engines/schedule-retrieval.engine.js';
import { evaluateEligibility } from './engines/eligibility.engine.js';
import { computeBoosterStatuses } from './engines/booster.engine.js';
import { detectMissedVaccines } from './engines/missed-vaccine.engine.js';
import { buildReminderRecommendations } from './engines/reminder.engine.js';
import { evaluateVaccineInteractions } from './engines/vaccine-interaction-check.engine.js';
import {
  buildDefaultSafetyMessaging,
  buildVaccineSafetyReport,
} from './engines/vaccine-safety-report.engine.js';
import {
  computeVaccineSessionConfidence,
  confidenceBadgeLabel,
  formatSafetySummary,
  shouldCreateEscalationRecord,
  shouldRecommendEscalation,
} from './engines/vaccine-confidence.engine.js';
import { classifyVaccineIntent } from './engines/vaccine-intent.engine.js';
import { getVaccineEscalationEngine } from './engines/vaccine-escalation.engine.js';
import { loadLivestockVaccinationHistory } from './engines/vaccine-history.loader.js';
import { buildVaccineCitation } from './engines/vaccine-metadata.util.js';
import {
  containsAdministrationImperative,
  containsDiagnosisLanguage,
  sanitizeVaccineOutput,
} from './engines/vaccine-output.guard.js';

function blockedContent(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'টিকা সূচি সম্পর্কিত প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত তথ্য নেই। জাতীয় সূচি অনুযায়ী তথ্য শুধুমাত্র যাচাইকৃত সূত্র থেকে দেখানো যায়। অনুগ্রহ করে পশুচিকিৎসকের পরামর্শ নিন।'
    : 'Insufficient verified knowledge for this vaccination question. Schedule facts are shown only from verified sources. Please consult a licensed veterinarian.';
}

function formatScheduleSummary(
  schedules: ScheduleRetrievalResult['schedules'],
  eligibility: EligibilityResult[],
  locale: 'bn' | 'en',
): string {
  if (schedules.length === 0) return '';
  const header = locale === 'bn' ? 'প্রকাশিত টিকা সূচি (সূত্রসহ):' : 'Published schedules (with sources):';
  const lines = schedules.map((s) => {
    const el = eligibility.find((e: EligibilityResult) => e.scheduleSlug === s.slug);
    const status = el ? ` [${el.status}]` : '';
    const window = s.ageWindow ?? '';
    const booster = s.boosterIntervalDays ? ` booster=${s.boosterIntervalDays}d` : '';
    const cites = s.citations.map((c) => c.token).join(' ');
    return `- ${s.titleBn}${status}: ${window}${booster} ${cites}`;
  });
  return [header, ...lines].join('\n');
}

export class AiVaccineOrchestratorService {
  readonly name = 'AiVaccineOrchestratorService';

  async createSession(input: CreateVaccineSessionInput): Promise<AiVaccineSession> {
    return getVaccineSessionEngine().createSession(input);
  }

  async getSession(sessionId: string, userId: string): Promise<AiVaccineSession> {
    return getVaccineSessionEngine().loadSession(sessionId, userId);
  }

  async lookupVaccine(params: {
    query: string;
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
  }): Promise<VaccineLookupResult> {
    const matches = await searchVaccines({ query: params.query, species: params.species });
    return { matches, query: params.query };
  }

  async retrieveSchedules(params: {
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
    antigen?: string;
  }): Promise<ScheduleRetrievalResult> {
    const schedules = await retrieveSpeciesSchedules(params);
    const citations = schedules.flatMap((s) => s.citations);
    return { schedules, citations };
  }

  async checkEligibility(params: {
    species: import('../../../generated/prisma/index.js').LivestockSpecies;
    ageDays?: number;
    antigen?: string;
  }): Promise<EligibilityCheckResult> {
    const schedules = await retrieveSpeciesSchedules({
      species: params.species,
      ...(params.antigen !== undefined ? { antigen: params.antigen } : {}),
    });
    const results = evaluateEligibility(
      omitUndefined({ schedules, ageDays: params.ageDays }),
    );
    const citations = results.flatMap((r) => r.citations);
    return { results, citations };
  }

  async checkBoosters(params: {
    session: AiVaccineSession;
    vaccineSlugs?: string[];
  }): Promise<BoosterCheckResult> {
    const schedules = await retrieveSpeciesSchedules({ species: params.session.species });
    const slugs = params.vaccineSlugs ?? params.session.vaccineSlugs;
    const entries = await loadVaccineBySlugs(slugs);
    let history: import('./engines/booster.engine.js').VaccinationHistoryRow[] = [];
    if (params.session.customerId && params.session.livestockId) {
      history = await loadLivestockVaccinationHistory({
        customerId: params.session.customerId,
        livestockId: params.session.livestockId,
      });
    }
    const boosters = computeBoosterStatuses({
      schedules,
      entries,
      history,
      vaccineSlugs: slugs,
    });
    return { boosters, citations: boosters.flatMap((b) => b.citations) };
  }

  async detectMissed(params: {
    session: AiVaccineSession;
  }): Promise<MissedVaccineResult> {
    const schedules = await retrieveSpeciesSchedules({ species: params.session.species });
    const entries = await loadVaccineBySlugs(params.session.vaccineSlugs);
    let history: import('./engines/booster.engine.js').VaccinationHistoryRow[] = [];
    if (params.session.customerId && params.session.livestockId) {
      history = await loadLivestockVaccinationHistory({
        customerId: params.session.customerId,
        livestockId: params.session.livestockId,
      });
    }
    const alerts = detectMissedVaccines({
      history,
      schedules,
      entries,
      locale: params.session.locale,
    });
    return { alerts, citations: alerts.flatMap((a) => a.citations) };
  }

  async recommendReminders(params: {
    session: AiVaccineSession;
    confidenceTier: import('./ai-vaccine.types.js').ConfidenceTier;
  }): Promise<ReminderRecommendationsResult> {
    const { boosters } = await this.checkBoosters({ session: params.session });
    const schedules = await retrieveSpeciesSchedules({ species: params.session.species });
    const reminders = buildReminderRecommendations({
      boosters,
      schedules,
      ...(params.session.livestockId !== undefined ? { livestockId: params.session.livestockId } : {}),
      confidenceTier: params.confidenceTier,
    });
    return { reminders, citations: reminders.flatMap((r) => r.citations) };
  }

  async checkInteractions(params: {
    vaccineSlugs: string[];
    medicineSlugs: string[];
  }): Promise<VaccineInteractionCheckResult> {
    const entries = await loadVaccineBySlugs(params.vaccineSlugs);
    const report = await evaluateVaccineInteractions({
      vaccineEntries: entries,
      vaccineSlugs: params.vaccineSlugs,
      medicineSlugs: params.medicineSlugs,
    });
    const citations = [
      ...report.vaccineConflicts.flatMap((c) => c.citations),
      ...report.medicineConflicts.flatMap((c) => c.citations),
    ];
    return {
      report,
      citations,
      safetyClassification: report.overallRisk,
    };
  }

  async analyze(
    sessionId: string,
    userId: string,
    input: VaccineAnalyzeInput,
  ): Promise<VaccineAnalyzeResult> {
    const sessionEngine = getVaccineSessionEngine();
    let session = await sessionEngine.loadSession(sessionId, userId);
    session = sessionEngine.transitionState(session, 'ANALYZING');

    const query =
      input.message?.trim() ||
      input.query?.trim() ||
      (input.vaccineSlugs?.length ? input.vaccineSlugs.join(' ') : 'vaccination schedule');

    const intentResult = input.message ? classifyVaccineIntent(input.message) : { intent: 'GENERAL' as const };

    let vaccineSlugs = [...new Set([...session.vaccineSlugs, ...(input.vaccineSlugs ?? [])])];
    const medicineSlugs = [...new Set([...session.medicineSlugs, ...(input.medicineSlugs ?? [])])];

    if ((input.query || input.message) && vaccineSlugs.length === 0) {
      const searchQ = input.query ?? input.message ?? '';
      const matches = await searchVaccines({ query: searchQ, species: session.species });
      vaccineSlugs = matches.map((m) => m.slug);
    }

    session.vaccineSlugs = vaccineSlugs;
    session.medicineSlugs = medicineSlugs;

    const vaccineEntries = await loadVaccineBySlugs(vaccineSlugs);
    const vaccineMatches =
      vaccineEntries.length > 0
        ? vaccineEntries.map((entry) => ({
            entityId: entry.id,
            slug: entry.slug,
            titleBn: entry.titleBn,
            titleEn: entry.titleEn,
            entityType: entry.entityType,
            confidenceScore: entry.confidenceScore,
            citations: [buildVaccineCitation(entry)],
          }))
        : await searchVaccines({ query, species: session.species });

    const referenceCards = vaccineEntries.map((e) => buildVaccineReferenceCard(e));
    const schedules = await retrieveSpeciesSchedules({ species: session.species });
    const eligibility = evaluateEligibility(
      omitUndefined({ schedules, ageDays: session.ageDays }),
    );

    let history: import('./engines/booster.engine.js').VaccinationHistoryRow[] = [];
    if (session.customerId && session.livestockId) {
      history = await loadLivestockVaccinationHistory({
        customerId: session.customerId,
        livestockId: session.livestockId,
      });
    }

    const boosters = computeBoosterStatuses({
      schedules,
      entries: vaccineEntries,
      history,
      vaccineSlugs,
    });
    const missedAlerts = detectMissedVaccines({
      history,
      schedules,
      entries: vaccineEntries,
      locale: session.locale,
    });

    const interactions =
      vaccineSlugs.length > 0 && (medicineSlugs.length > 0 || intentResult.intent === 'INTERACTION')
        ? await evaluateVaccineInteractions({
            vaccineEntries,
            vaccineSlugs,
            medicineSlugs,
          })
        : undefined;

    const pack = await getKnowledgeRetrievalService().retrieve({
      query,
      locale: session.locale,
      taskType: VACCINE_TASK_TYPE,
      feature: VACCINE_FEATURE,
      profileId: VACCINE_RETRIEVAL_PROFILE,
      species: session.species,
    });

    const safetyReport = buildVaccineSafetyReport({
      entries: vaccineEntries,
      eligibility,
      missedAlerts,
      boosters,
      ...(interactions !== undefined ? { interactions } : {}),
      pregnancy: session.pregnancy,
      pack,
    });

    const hasScheduleFacts =
      schedules.length > 0 ||
      pack.structuredFacts.some((f) =>
        ['SCHEDULE_AGE_WINDOW', 'BOOSTER_INTERVAL_DAYS', 'VACCINE_IDENTITY'].includes(f.factType),
      );

    const confidence = computeVaccineSessionConfidence({ pack, safetyReport, hasScheduleFacts });
    const scheduleIntentWithoutGrounding =
      (intentResult.intent === 'SCHEDULE' || intentResult.intent === 'BOOSTER') &&
      schedules.length === 0 &&
      !hasScheduleFacts;
    const routingBlocked =
      pack.routingDecision.action === 'BLOCK' ||
      confidence.failClosed ||
      intentResult.blockInVaccine === true ||
      scheduleIntentWithoutGrounding;

    const safetyMessaging = buildDefaultSafetyMessaging();
    const reminders = buildReminderRecommendations({
      boosters,
      schedules,
      ...(session.livestockId !== undefined ? { livestockId: session.livestockId } : {}),
      confidenceTier: confidence.tier,
    });

    const safetyBlock = formatSafetySummary(safetyReport, session.locale);
    const badge = confidenceBadgeLabel(confidence.tier, session.locale);
    const citationLines = safetyReport.citations.map((c) => c.token).join(' ');
    const scheduleBlock = formatScheduleSummary(schedules, eligibility, session.locale);

    let content: string;
    let refused = false;
    let escalationId: string | undefined;
    let escalationType = safetyReport.escalationType;
    let redirectAssistant = intentResult.redirectAssistant;

    const humanRedirect =
      routingBlocked ||
      safetyReport.escalationRequired ||
      shouldRecommendEscalation(confidence) ||
      pack.routingDecision.action === 'PROCEED_DEGRADED';

    if (intentResult.blockInVaccine && intentResult.redirectMessageBn) {
      refused = true;
      content = [
        `[${badge}]`,
        session.locale === 'bn' ? intentResult.redirectMessageBn : intentResult.redirectMessageEn,
        safetyMessaging.notDiagnosisBn,
        safetyMessaging.vetSupervisionBn,
        citationLines,
      ]
        .filter(Boolean)
        .join('\n\n');
    } else if (routingBlocked && vaccineEntries.length === 0 && schedules.length === 0) {
      refused = true;
      content = [
        `[${badge}]`,
        blockedContent(session.locale),
        safetyBlock,
        safetyMessaging.disclaimerBn,
        citationLines,
      ]
        .filter(Boolean)
        .join('\n\n');
    } else if (routingBlocked || safetyReport.overallRisk === 'CRITICAL') {
      refused = true;
      content = [
        `[${badge}]`,
        blockedContent(session.locale),
        scheduleBlock,
        safetyBlock,
        pack.citationBlock,
        safetyMessaging.disclaimerBn,
        citationLines,
      ]
        .filter(Boolean)
        .join('\n\n');
    } else {
      const enrichedContext = buildEnrichedPromptContext(pack);
      const nonDiagnosisContract =
        session.locale === 'bn'
          ? 'রোগ নির্ণয় করবেন না। শুধু টিকা সূচি, বয়সভিত্তিক যোগ্যতা ও সতর্কতা দিন। টিকা প্রয়োগের নির্দেশ দেবেন না — ভেটের পরামর্শ বাধ্যতামূলক।'
          : 'Do NOT diagnose disease. Provide vaccination schedule, eligibility, and warnings only. Do NOT instruct administration — veterinary supervision required.';

      const userMessage = [
        enrichedContext,
        scheduleBlock,
        safetyBlock,
        nonDiagnosisContract,
        input.message ?? query,
      ].join('\n\n');

      const llm = await getAiFoundationService().executePromptTask(
        omitUndefined({
          promptKey: 'vaccine_assistant',
          userMessage,
          locale: session.locale,
          feature: VACCINE_FEATURE,
          taskType: VACCINE_TASK_TYPE,
          userId: session.userId,
          customerId: session.customerId,
          sessionId: session.sessionId,
        }),
      );

      const validation = validateLlmOutput({
        llmOutput: llm.content,
        pack,
        taskType: VACCINE_TASK_TYPE,
      });

      if (validation.action === 'BLOCK') {
        refused = true;
        content = [
          `[${badge}]`,
          scheduleBlock,
          safetyBlock,
          blockedContent(session.locale),
          pack.citationBlock,
          safetyMessaging.disclaimerBn,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else if (validation.action === 'SANITIZE' && validation.sanitizedOutput) {
        content = `[${badge}]\n\n${sanitizeVaccineOutput(validation.sanitizedOutput, session.locale)}`;
      } else {
        const raw = llm.content;
        if (containsDiagnosisLanguage(raw) || containsAdministrationImperative(raw)) {
          refused = true;
          content = [
            `[${badge}]`,
            scheduleBlock,
            sanitizeVaccineOutput(raw, session.locale),
            safetyMessaging.disclaimerBn,
            citationLines,
          ]
            .filter(Boolean)
            .join('\n\n');
        } else {
          content = `[${badge}]\n\n${raw}`;
        }
      }

      if (pack.citationBlock.trim()) {
        content = `${content}\n\n${pack.citationBlock}`;
      }
      content = `${content}\n\n${safetyMessaging.disclaimerBn}\n${safetyMessaging.vetSupervisionBn}\n${citationLines}`;
    }

    if (
      shouldCreateEscalationRecord({
        refused,
        routingBlocked,
        safetyReport,
      })
    ) {
      const esc = await getVaccineEscalationEngine().createEscalation(
        omitUndefined({
          userId,
          sessionId: session.sessionId,
          vaccineSessionId: session.id,
          safetyReport,
          confidence,
          triggerRuleId: refused ? 'VACCINE_SCHEDULE_BLOCK' : 'SAFETY_ESCALATION',
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
        action: 'VACCINE_ANALYZE',
        detailJson: {
          vaccineSessionId: session.id,
          packId: pack.packId,
          routingDecision: pack.routingDecision.action,
          confidence: confidence.sessionScore,
          safetyClassification: safetyReport.safetyClassification,
          vaccineSlugs,
          refused,
          intent: intentResult.intent,
          feature: VACCINE_FEATURE,
        },
      }),
    );

    return {
      session,
      refused,
      content,
      vaccineMatches,
      referenceCards,
      schedules,
      eligibility,
      boosters,
      missedAlerts,
      reminders,
      ...(interactions !== undefined ? { interactions } : {}),
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
      safetyMessaging,
      ...(redirectAssistant !== undefined ? { redirectAssistant } : {}),
    };
  }

  async escalate(
    sessionId: string,
    userId: string,
  ): Promise<{ session: AiVaccineSession; escalationId: string; escalationType: string }> {
    const sessionEngine = getVaccineSessionEngine();
    const session = await sessionEngine.loadSession(sessionId, userId);

    const schedules = await retrieveSpeciesSchedules({ species: session.species });
    const safetyReport = buildVaccineSafetyReport({
      entries: await loadVaccineBySlugs(session.vaccineSlugs),
      eligibility: evaluateEligibility(
        omitUndefined({ schedules, ageDays: session.ageDays }),
      ),
      missedAlerts: [],
      boosters: [],
      pregnancy: session.pregnancy,
    });

    const confidence = computeVaccineSessionConfidence({
      safetyReport,
      hasScheduleFacts: schedules.length > 0,
    });

    const { escalationId, escalationType } = await getVaccineEscalationEngine().createEscalation(
      omitUndefined({
        userId,
        sessionId: session.sessionId,
        vaccineSessionId: session.id,
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
        action: 'VACCINE_ESCALATE',
        detailJson: {
          vaccineSessionId: session.id,
          escalationId,
          escalationType,
        },
      }),
    );

    return { session: updated, escalationId, escalationType };
  }

  private async persistTurn(
    session: AiVaccineSession,
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
        vaccineSessionId: session.id,
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
        vaccineSessionId: session.id,
        packId,
        refused,
      },
    });
  }
}

let service: AiVaccineOrchestratorService | null = null;

export function getAiVaccineOrchestratorService(): AiVaccineOrchestratorService {
  if (!service) service = new AiVaccineOrchestratorService();
  return service;
}

export function resetAiVaccineOrchestratorForTests(): void {
  service = null;
}
