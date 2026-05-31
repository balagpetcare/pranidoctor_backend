import type { AiKnowledgeClinicalRiskTier } from '../../../../generated/prisma/index.js';
import type {
  ConfidenceRoutingDecision,
  RetrievalProfile,
  RetrievedChunk,
  StructuredFact,
} from '../knowledge-retrieval.types.js';
import { MEDICAL_CONTENT_TYPES as MEDICAL_TYPES } from '../knowledge-retrieval.types.js';
import { meetsRetrievalGate } from '../../knowledge-ingestion/scoring/confidence.engine.js';

const MEDICAL_QUERY_PATTERNS = [
  /\b(dose|dosage|mg\/kg|ml\/kg|withdrawal|prescription|antibiotic|medicine|drug|vaccine|treatment|diagnos)\b/i,
  /(ওষুধ|মাত্রা|টিকা|চিকিৎসা|রোগ|অ্যান্টিবায়োটিক|withdrawal|ইঞ্জেকশন|injec)/i,
];

const EMERGENCY_QUERY_PATTERNS = [
  /\b(emergency|urgent|bleeding|collapse|poison|seizure|dying)\b/i,
  /(জরুরি|রক্ত|বমি|পড়ে|মর|জ্বর খুব)/i,
];

export type MedicalRiskTier = 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL';

const TREATMENT_REQUEST_PATTERNS = [
  /\b(treatment|prescription|antibiotic|dose|dosage|mg\/kg|ml\/kg|without vet|prescribe)\b/i,
  /(চিকিৎসা|ওষুধ|মাত্রা|antibiotic|ইঞ্জেকশন)/i,
];

export function detectDirectTreatmentOrPrescriptionRequest(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;
  const asksForSigns = /\b(signs?|symptoms?|লক্ষণ)\b/i.test(normalized);
  if (asksForSigns) return false;
  return TREATMENT_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectMedicalIntent(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;
  return MEDICAL_QUERY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function detectEmergencyIntent(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;
  return EMERGENCY_QUERY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function assessMedicalRiskTier(params: {
  query: string;
  taskType: string;
  chunks: RetrievedChunk[];
  emergencyFlag?: boolean;
}): MedicalRiskTier {
  if (params.emergencyFlag || detectEmergencyIntent(params.query)) return 'CRITICAL';
  if (params.taskType === 'PRESCRIPTION_ANALYSIS') return 'HIGH';
  if (params.taskType === 'EMERGENCY_CONSULTATION') return 'CRITICAL';

  const hasHighRiskChunk = params.chunks.some(
    (c) => c.clinicalRiskTier === 'HIGH' || c.clinicalRiskTier === 'CRITICAL',
  );
  if (hasHighRiskChunk) return 'HIGH';

  if (detectMedicalIntent(params.query)) return 'HIGH';
  return 'NONE';
}

export function evaluateMedicalSafety(params: {
  profile: RetrievalProfile;
  query: string;
  taskType: string;
  chunks: RetrievedChunk[];
  structuredFacts: StructuredFact[];
  embeddingCoverage: number;
  semanticEnabled: boolean;
  emergencyFlag?: boolean;
}): ConfidenceRoutingDecision {
  const medicalRiskTier = assessMedicalRiskTier({
    query: params.query,
    taskType: params.taskType,
    chunks: params.chunks,
    ...(params.emergencyFlag !== undefined ? { emergencyFlag: params.emergencyFlag } : {}),
  });

  if (
    params.taskType !== 'PRESCRIPTION_ANALYSIS' &&
    params.taskType !== 'FEED_FORMULATION' &&
    detectDirectTreatmentOrPrescriptionRequest(params.query)
  ) {
    return {
      action: 'BLOCK',
      reason: 'Direct treatment or prescription requests require veterinary consultation',
      failClosed: true,
      disclaimerLevel: 'blocking',
      medicalRiskTier: 'HIGH',
    };
  }

  const medicalChunks = params.chunks.filter((c) =>
    (MEDICAL_TYPES as readonly string[]).includes(c.contentType),
  );

  if (params.profile.taskType === 'PRESCRIPTION_ANALYSIS') {
    if (params.structuredFacts.length === 0) {
      return {
        action: 'BLOCK',
        reason: 'Prescription retrieval requires structured dose facts',
        failClosed: true,
        disclaimerLevel: 'blocking',
        medicalRiskTier,
      };
    }
    const confidences = params.chunks.map((c) => c.confidenceScore);
    const avg = confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1);
    const min = confidences.length > 0 ? Math.min(...confidences) : 0;
    if (avg < params.profile.minConfidence || min < params.profile.medicalMinConfidence) {
      return {
        action: 'BLOCK',
        reason: 'Prescription confidence below gate',
        failClosed: true,
        disclaimerLevel: 'blocking',
        medicalRiskTier,
      };
    }
  }

  if (detectMedicalIntent(params.query) && params.chunks.length === 0) {
    return {
      action: 'BLOCK',
      reason: 'Medical query requires grounded knowledge — no LLM-only medical answers',
      failClosed: true,
      disclaimerLevel: 'blocking',
      medicalRiskTier,
    };
  }

  if (params.profile.blockLowConfidenceMedical && medicalChunks.length > 0) {
    const medicalMin = Math.min(...medicalChunks.map((c) => c.confidenceScore));
    const allMedicalPass = medicalChunks.every((c) =>
      meetsRetrievalGate({
        confidence: c.confidenceScore,
        evidenceLevel: c.evidenceLevel,
        minConfidence: params.profile.medicalMinConfidence,
        minEvidence: params.profile.minEvidenceLevel,
      }),
    );

    if (medicalMin < params.profile.medicalMinConfidence || !allMedicalPass) {
      return {
        action: 'BLOCK',
        reason: 'Low-confidence medical advice blocked',
        failClosed: true,
        disclaimerLevel: 'blocking',
        medicalRiskTier,
      };
    }
  }

  if (medicalRiskTier === 'CRITICAL' && params.chunks.length === 0) {
    return {
      action: 'PROCEED_DEGRADED',
      reason: 'Emergency keywords detected but no grounded chunks — referral mode',
      failClosed: false,
      disclaimerLevel: 'elevated',
      medicalRiskTier,
    };
  }

  return {
    action: 'PROCEED',
    reason: 'Medical safety gates satisfied',
    failClosed: params.profile.failClosed,
    disclaimerLevel: 'standard',
    medicalRiskTier,
  };
}

export function isHighClinicalRisk(tier: AiKnowledgeClinicalRiskTier): boolean {
  return tier === 'HIGH' || tier === 'CRITICAL';
}
