import type { KnowledgeContextPack } from '../../knowledge-retrieval/knowledge-retrieval.types.js';
import { AI_CONFIDENCE_ESCALATION_THRESHOLD } from '../../../ai-veterinary-core/safety/ai-safety.guardrails.js';

import {
  AI_DOCTOR_ESCALATION_CONFIDENCE,
  AI_DOCTOR_FAIL_CLOSED_CONFIDENCE,
} from '../ai-doctor.constants.js';
import type {
  CaseConfidence,
  ConfidenceTier,
  GroundedDifferential,
  SymptomCompletenessScore,
} from '../ai-doctor.types.js';

export function tierFromScore(score: number): ConfidenceTier {
  if (score >= 0.7) return 'STRONG';
  if (score >= 0.5) return 'MODERATE';
  if (score >= AI_DOCTOR_FAIL_CLOSED_CONFIDENCE) return 'LIMITED';
  return 'INSUFFICIENT';
}

export function computeCaseConfidence(params: {
  pack?: KnowledgeContextPack;
  differentials: GroundedDifferential[];
  completeness: SymptomCompletenessScore;
}): CaseConfidence {
  const retrievalAvg = params.pack?.confidenceSummary.avg ?? 0;
  const differentialTop =
    params.differentials.length > 0
      ? Math.max(...params.differentials.map((d) => d.confidenceScore))
      : 0;

  let caseScore =
    retrievalAvg * 0.4 + differentialTop * 0.35 + params.completeness.score * 0.25;

  if (params.completeness.score < 0.6) {
    caseScore = Math.min(caseScore, 0.55);
  }
  if (params.differentials.length === 0) {
    caseScore = Math.min(caseScore, 0.3);
  }

  caseScore = Math.round(caseScore * 100) / 100;
  const tier = tierFromScore(caseScore);
  const failClosed = caseScore < AI_DOCTOR_FAIL_CLOSED_CONFIDENCE || tier === 'INSUFFICIENT';

  return {
    retrievalAvg,
    differentialTop,
    caseScore,
    tier,
    failClosed,
  };
}

export function shouldFailClosed(params: {
  confidence: CaseConfidence;
  routingAction: string;
  hasGroundedCitations: boolean;
}): boolean {
  if (params.confidence.failClosed) return true;
  if (params.routingAction === 'BLOCK') return true;
  if (!params.hasGroundedCitations) return true;
  if (
    params.routingAction === 'PROCEED_DEGRADED' &&
    params.confidence.caseScore < AI_DOCTOR_ESCALATION_CONFIDENCE
  ) {
    return true;
  }
  return false;
}

export function shouldRecommendEscalation(confidence: CaseConfidence): boolean {
  return confidence.caseScore < AI_CONFIDENCE_ESCALATION_THRESHOLD;
}

export function confidenceBadgeLabel(tier: ConfidenceTier, locale: 'bn' | 'en'): string {
  const labels: Record<ConfidenceTier, { bn: string; en: string }> = {
    STRONG: { bn: 'শক্ত প্রমাণ', en: 'Strong evidence' },
    MODERATE: { bn: 'মাঝারি প্রমাণ — চিকিৎসক নিশ্চিত করুন', en: 'Moderate evidence — confirm with vet' },
    LIMITED: { bn: 'সীমিত তথ্য', en: 'Limited information' },
    INSUFFICIENT: { bn: 'পর্যাপ্ত তথ্য নেই', en: 'Insufficient information' },
  };
  return locale === 'bn' ? labels[tier].bn : labels[tier].en;
}

export function citationCoverage(pack?: KnowledgeContextPack): number {
  if (!pack || pack.chunks.length === 0) return 0;
  const cited = pack.chunks.filter((c) => c.inlineCitation.trim().length > 0).length;
  return cited / pack.chunks.length;
}

export class ConfidenceEngine {
  readonly name = 'ConfidenceEngine';

  computeCaseConfidence = computeCaseConfidence;
  shouldFailClosed = shouldFailClosed;
  shouldRecommendEscalation = shouldRecommendEscalation;
  tierFromScore = tierFromScore;
  badgeLabel = confidenceBadgeLabel;
  citationCoverage = citationCoverage;
}

let engine: ConfidenceEngine | null = null;

export function getConfidenceEngine(): ConfidenceEngine {
  if (!engine) engine = new ConfidenceEngine();
  return engine;
}

export function resetConfidenceEngineForTests(): void {
  engine = null;
}
