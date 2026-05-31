import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';

import {
  PRESCRIPTION_ESCALATION_CONFIDENCE,
  PRESCRIPTION_FAIL_CLOSED_CONFIDENCE,
  PRESCRIPTION_MIN_CONFIDENCE,
} from '../ai-prescription.constants.js';
import type { ConfidenceTier, PrescriptionSafetyReport, SessionConfidence } from '../ai-prescription.types.js';

export function tierFromScore(score: number): ConfidenceTier {
  if (score >= 0.85) return 'VERIFIED';
  if (score >= PRESCRIPTION_MIN_CONFIDENCE) return 'MODERATE';
  return 'INSUFFICIENT';
}

export function confidenceBadgeLabel(tier: ConfidenceTier, locale: 'bn' | 'en'): string {
  const labels: Record<ConfidenceTier, { bn: string; en: string }> = {
    VERIFIED: { bn: 'যাচাইকৃত তথ্য', en: 'Verified information' },
    MODERATE: { bn: 'ভেটের পরামর্শ নিন', en: 'Consult your veterinarian' },
    INSUFFICIENT: { bn: 'যথেষ্ট তথ্য নেই', en: 'Insufficient information' },
  };
  return locale === 'bn' ? labels[tier].bn : labels[tier].en;
}

export function computeSessionConfidence(params: {
  pack?: KnowledgeContextPack;
  safetyReport: PrescriptionSafetyReport;
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

  const sessionScore = Math.max(0, Math.min(1, retrievalAvg - safetyPenalty));
  const tier = tierFromScore(sessionScore);
  const routingBlock = params.pack?.routingDecision.action === 'BLOCK';

  return {
    retrievalAvg,
    sessionScore,
    tier,
    failClosed: routingBlock || sessionScore < PRESCRIPTION_FAIL_CLOSED_CONFIDENCE,
  };
}

export function shouldRecommendEscalation(confidence: SessionConfidence): boolean {
  return confidence.sessionScore < PRESCRIPTION_ESCALATION_CONFIDENCE || confidence.failClosed;
}

export function shouldSkipLlmForFarmerDoseRequest(params: {
  message: string;
  mode: 'FARMER_REFERENCE' | 'VET_VALIDATION';
}): boolean {
  if (params.mode !== 'FARMER_REFERENCE') return false;
  const enDoseIntent =
    /\b(dose|dosage|mg\/kg|ml\/kg|how much|prescribe|inject|administer)\b/i.test(params.message);
  const bnDoseIntent = /(কত|মাত্রা|ইঞ্জেকশন)/.test(params.message);
  return enDoseIntent || bnDoseIntent;
}

/** Create DB escalation only on clinical triggers — not every degraded proceed. */
export function shouldCreateEscalationRecord(params: {
  refused: boolean;
  routingBlocked: boolean;
  safetyReport: PrescriptionSafetyReport;
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
  report: PrescriptionSafetyReport,
  locale: 'bn' | 'en',
): string {
  const lines: string[] = [];
  const header =
    locale === 'bn'
      ? `নিরাপত্তা শ্রেণি: ${report.safetyClassification}`
      : `Safety classification: ${report.safetyClassification}`;
  lines.push(header);

  for (const w of report.warnings) {
    lines.push(locale === 'bn' ? w.messageBn : w.messageEn);
  }

  for (const ci of report.contraindications.slice(0, 5)) {
    lines.push(locale === 'bn' ? ci.descriptionBn : ci.descriptionEn);
  }

  for (const ix of report.interactions) {
    const msg =
      locale === 'bn'
        ? `মিথস্ক্রিয়া (${ix.drugA} + ${ix.drugB}): ${ix.severity}`
        : `Interaction (${ix.drugA} + ${ix.drugB}): ${ix.severity}`;
    lines.push(msg);
  }

  if (report.withdrawalSummary) {
    for (const p of report.withdrawalSummary.periods) {
      lines.push(
        locale === 'bn'
          ? `${p.productType} প্রত্যাহার: ${p.withdrawalDays} দিন`
          : `${p.productType} withdrawal: ${p.withdrawalDays} days`,
      );
    }
  }

  return lines.join('\n');
}
