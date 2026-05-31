import type { AiKnowledgeEvidenceLevel } from '../../../../generated/prisma/index.js';
import { PROVISIONAL_CONFIDENCE_CAP } from '../knowledge-ingestion.types.js';
import { evidenceLevelScore } from './evidence-level.engine.js';

export type ConfidenceInput = {
  evidenceLevel: AiKnowledgeEvidenceLevel;
  trustTier: number;
  extractQualityScore?: number;
  dedupConfidence?: number;
  reviewCompletenessScore?: number;
  graphConnectivityScore?: number;
  lastReviewedAt?: Date;
  provisional?: boolean;
};

function trustTierScore(trustTier: number): number {
  const normalized = Math.min(4, Math.max(1, trustTier));
  return 1 - (normalized - 1) * 0.2;
}

function recencyScore(lastReviewedAt?: Date): number {
  if (!lastReviewedAt) return 0.5;
  const months = (Date.now() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return Math.pow(0.5, months / 18);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeConfidenceScore(input: ConfidenceInput): number {
  const evidence = evidenceLevelScore(input.evidenceLevel);
  const trust = trustTierScore(input.trustTier);
  const extract = input.extractQualityScore ?? 0.75;
  const dedup = input.dedupConfidence ?? 1;
  const review = input.reviewCompletenessScore ?? 0;
  const graph = input.graphConnectivityScore ?? 0;
  const recency = recencyScore(input.lastReviewedAt);

  if (input.provisional) {
    const provisional = clamp(
      0.4 * evidence + 0.35 * trust + 0.15 * extract + 0.1 * dedup,
      0,
      PROVISIONAL_CONFIDENCE_CAP,
    );
    return provisional;
  }

  return clamp(
    0.35 * evidence +
      0.25 * trust +
      0.2 * recency +
      0.1 * review +
      0.1 * graph,
    0,
    1,
  );
}

export function meetsRetrievalGate(params: {
  confidence: number;
  evidenceLevel: AiKnowledgeEvidenceLevel;
  minConfidence: number;
  minEvidence: AiKnowledgeEvidenceLevel;
}): boolean {
  const order = ['L1', 'L2', 'L3', 'L4', 'L5'] as AiKnowledgeEvidenceLevel[];
  const evidenceOk =
    order.indexOf(params.evidenceLevel) >= order.indexOf(params.minEvidence);
  return params.confidence >= params.minConfidence && evidenceOk;
}
