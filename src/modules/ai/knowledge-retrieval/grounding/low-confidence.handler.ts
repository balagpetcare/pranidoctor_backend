import type {
  ConfidenceRoutingDecision,
  RetrievalProfile,
  RetrievedChunk,
  StructuredFact,
} from '../knowledge-retrieval.types.js';
import { isLowConfidenceSummary, buildConfidenceSummary } from '../packs/confidence-builder.js';

export function applyLowConfidencePolicy(params: {
  profile: RetrievalProfile;
  chunks: RetrievedChunk[];
  structuredFacts: StructuredFact[];
  embeddingCoverage: number;
  semanticEnabled: boolean;
  baseDecision: ConfidenceRoutingDecision;
}): ConfidenceRoutingDecision {
  const { profile, chunks, baseDecision } = params;

  if (baseDecision.action === 'PROCEED_DEGRADED' && chunks.length === 0) {
    return baseDecision;
  }

  if (baseDecision.action === 'BLOCK') return baseDecision;

  if (chunks.length === 0) {
    if (profile.failClosed) {
      return {
        action: 'BLOCK',
        reason: 'No grounded knowledge retrieved',
        failClosed: true,
        disclaimerLevel: 'blocking',
        medicalRiskTier: params.baseDecision.medicalRiskTier,
      };
    }
    return {
      action: 'PROCEED_DEGRADED',
      reason: 'Empty retrieval pack',
      failClosed: false,
      disclaimerLevel: 'elevated',
      medicalRiskTier: params.baseDecision.medicalRiskTier,
    };
  }

  const summary = buildConfidenceSummary(chunks);

  if (isLowConfidenceSummary(summary, profile.minConfidence)) {
    if (profile.failClosed) {
      return {
        action: 'BLOCK',
        reason: 'Average confidence below profile minimum',
        failClosed: true,
        disclaimerLevel: 'blocking',
        medicalRiskTier: params.baseDecision.medicalRiskTier,
      };
    }
    return {
      action: 'PROCEED_DEGRADED',
      reason: 'Below minimum confidence — degraded mode',
      failClosed: false,
      disclaimerLevel: 'elevated',
      medicalRiskTier: params.baseDecision.medicalRiskTier,
    };
  }

  if (params.semanticEnabled && params.embeddingCoverage < 0.5) {
    return {
      action: 'PROCEED_DEGRADED',
      reason: 'Partial embedding coverage',
      failClosed: false,
      disclaimerLevel: 'elevated',
      medicalRiskTier: params.baseDecision.medicalRiskTier,
    };
  }

  return baseDecision;
}
