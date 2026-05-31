import type {
  AiKnowledgeEvidenceLevel,
  VkConfidenceComputedBy,
} from '../../../../generated/prisma/index.js';
import {
  computeConfidenceScore,
  meetsRetrievalGate,
} from '../../knowledge-ingestion/scoring/confidence.engine.js';
import { evidenceLevelScore } from '../../knowledge-ingestion/scoring/evidence-level.engine.js';
import {
  CONFIDENCE_FORMULA_VERSION,
  PROVISIONAL_CONFIDENCE_CAP,
} from '../knowledge-chunking.types.js';

export type ConfidenceComponents = {
  evidence: number;
  trust: number;
  recency: number;
  review: number;
  graph: number;
  raw: number;
  capped: number;
};

export type ConfidenceAssignmentResult = {
  score: number;
  formulaVersion: string;
  provisional: boolean;
  computedBy: VkConfidenceComputedBy;
  components: ConfidenceComponents;
  meetsProfileGates: Record<string, boolean>;
};

const DEFAULT_PROFILE_GATES = [
  { id: 'farmer-chat-v1', minConfidence: 0.4, minEvidence: 'L3' as AiKnowledgeEvidenceLevel },
  { id: 'ai-doctor-v1', minConfidence: 0.55, minEvidence: 'L2' as AiKnowledgeEvidenceLevel },
  { id: 'prescription-v1', minConfidence: 0.65, minEvidence: 'L2' as AiKnowledgeEvidenceLevel },
  { id: 'emergency-v1', minConfidence: 0.7, minEvidence: 'L2' as AiKnowledgeEvidenceLevel },
];

function trustTierScore(trustTier: number): number {
  const normalized = Math.min(4, Math.max(1, trustTier));
  return 1 - (normalized - 1) * 0.2;
}

function recencyScore(lastReviewedAt?: Date): number {
  if (!lastReviewedAt) return 0.5;
  const months = (Date.now() - lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return Math.pow(0.5, months / 18);
}

export class ConfidenceAssignmentService {
  readonly name = 'ConfidenceAssignmentService';

  compute(params: {
    evidenceLevel: AiKnowledgeEvidenceLevel;
    trustTier: number;
    provisional: boolean;
    computedBy: VkConfidenceComputedBy;
    reviewCompletenessScore?: number;
    graphConnectivityScore?: number;
    lastReviewedAt?: Date;
    clinicalRiskTier?: string;
  }): ConfidenceAssignmentResult {
    const review = params.reviewCompletenessScore ?? (params.provisional ? 0 : 0.8);
    const graph = params.graphConnectivityScore ?? 0;
    const recency = recencyScore(params.lastReviewedAt);
    const score = computeConfidenceScore({
      evidenceLevel: params.evidenceLevel,
      trustTier: params.trustTier,
      reviewCompletenessScore: review,
      graphConnectivityScore: graph,
      ...(params.lastReviewedAt ? { lastReviewedAt: params.lastReviewedAt } : {}),
      provisional: params.provisional,
    });

    const capped = params.provisional ? Math.min(score, PROVISIONAL_CONFIDENCE_CAP) : score;
    const components: ConfidenceComponents = {
      evidence: evidenceLevelScore(params.evidenceLevel),
      trust: trustTierScore(params.trustTier),
      recency,
      review,
      graph,
      raw: score,
      capped,
    };

    const meetsProfileGates: Record<string, boolean> = {};
    for (const gate of DEFAULT_PROFILE_GATES) {
      if (params.clinicalRiskTier === 'CRITICAL' && gate.id === 'farmer-chat-v1') {
        meetsProfileGates[gate.id] = false;
        continue;
      }
      meetsProfileGates[gate.id] = meetsRetrievalGate({
        confidence: capped,
        evidenceLevel: params.evidenceLevel,
        minConfidence: gate.minConfidence,
        minEvidence: gate.minEvidence,
      });
    }

    return {
      score: capped,
      formulaVersion: CONFIDENCE_FORMULA_VERSION,
      provisional: params.provisional,
      computedBy: params.computedBy,
      components,
      meetsProfileGates,
    };
  }
}

let service: ConfidenceAssignmentService | null = null;

export function getConfidenceAssignmentService(): ConfidenceAssignmentService {
  if (!service) service = new ConfidenceAssignmentService();
  return service;
}

export function resetConfidenceAssignmentForTests(): void {
  service = null;
}
