import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';

import {
  VACCINE_ESCALATION_CONFIDENCE,
  VACCINE_FAIL_CLOSED_CONFIDENCE,
  VACCINE_MIN_CONFIDENCE,
  VACCINE_SCHEDULE_MIN_CONFIDENCE,
} from '../ai-vaccine.constants.js';
import type { ConfidenceTier, SessionConfidence, VaccineSafetyReport } from '../ai-vaccine.types.js';

export function tierFromScore(score: number): ConfidenceTier {
  if (score >= 0.7) return 'STRONG';
  if (score >= VACCINE_MIN_CONFIDENCE) return 'MODERATE';
  if (score >= VACCINE_FAIL_CLOSED_CONFIDENCE) return 'LIMITED';
  return 'INSUFFICIENT';
}

export function confidenceBadgeLabel(tier: ConfidenceTier, locale: 'bn' | 'en'): string {
  const labels: Record<ConfidenceTier, { bn: string; en: string }> = {
    STRONG: { bn: 'জাতীয় সূচি অনুযায়ী', en: 'Per national schedule' },
    MODERATE: { bn: 'ভেটেরিনারিয়ান নিশ্চিত করুন', en: 'Confirm with veterinarian' },
    LIMITED: { bn: 'সীমিত তথ্য', en: 'Limited information' },
    INSUFFICIENT: { bn: 'পর্যাপ্ত তথ্য নেই', en: 'Insufficient information' },
  };
  return locale === 'bn' ? labels[tier].bn : labels[tier].en;
}

export function computeVaccineSessionConfidence(params: {
  pack?: KnowledgeContextPack;
  safetyReport: VaccineSafetyReport;
  hasScheduleFacts: boolean;
}): SessionConfidence {
  const retrievalAvg = params.pack?.confidenceSummary.avg ?? 0;
  const safetyPenalty =
    params.safetyReport.overallRisk === 'CRITICAL'
      ? 0.35
      : params.safetyReport.overallRisk === 'HIGH'
        ? 0.2
        : params.safetyReport.overallRisk === 'MODERATE'
          ? 0.1
          : 0;

  let sessionScore = Math.max(0, Math.min(1, retrievalAvg - safetyPenalty));
  if (!params.hasScheduleFacts && params.pack?.routingDecision.action !== 'PROCEED') {
    sessionScore = Math.min(sessionScore, VACCINE_SCHEDULE_MIN_CONFIDENCE - 0.05);
  }

  const tier = tierFromScore(sessionScore);
  const routingBlock = params.pack?.routingDecision.action === 'BLOCK';

  return {
    retrievalAvg,
    sessionScore,
    tier,
    failClosed: routingBlock || sessionScore < VACCINE_FAIL_CLOSED_CONFIDENCE,
  };
}

export function shouldRecommendEscalation(confidence: SessionConfidence): boolean {
  return confidence.sessionScore < VACCINE_ESCALATION_CONFIDENCE || confidence.failClosed;
}

export function shouldCreateEscalationRecord(params: {
  refused: boolean;
  routingBlocked: boolean;
  safetyReport: VaccineSafetyReport;
}): boolean {
  return (
    params.refused ||
    params.routingBlocked ||
    params.safetyReport.escalationRequired ||
    params.safetyReport.blockReasons.length > 0 ||
    params.safetyReport.overallRisk === 'CRITICAL'
  );
}

export function formatSafetySummary(
  report: VaccineSafetyReport,
  locale: 'bn' | 'en',
): string {
  if (report.warnings.length === 0) return '';
  const header = locale === 'bn' ? 'সতর্কতা:' : 'Warnings:';
  const lines = report.warnings.map((w) =>
    locale === 'bn' ? `- ${w.messageBn}` : `- ${w.messageEn}`,
  );
  return [header, ...lines].join('\n');
}
