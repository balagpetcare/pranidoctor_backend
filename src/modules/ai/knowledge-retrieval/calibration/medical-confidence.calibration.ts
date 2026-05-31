import type { RetrievalProfile } from '../knowledge-retrieval.types.js';
import { RETRIEVAL_PROFILES, resolveRetrievalProfile } from '../profiles/retrieval-profile.registry.js';

/** Calibrated medical confidence thresholds (Phase 6C.13). */
export type MedicalConfidenceCalibration = {
  profileId: string;
  version: number;
  minConfidence: number;
  medicalMinConfidence: number;
  minEvidenceLevel: RetrievalProfile['minEvidenceLevel'];
  lexicalWeight: number;
  semanticWeight: number;
  calibratedAt: string;
};

export const MEDICAL_CONFIDENCE_CALIBRATION: Record<string, MedicalConfidenceCalibration> = {
  'farmer-chat-v1': {
    profileId: 'farmer-chat-v1',
    version: 1,
    minConfidence: 0.4,
    medicalMinConfidence: 0.52,
    minEvidenceLevel: 'L1',
    lexicalWeight: 0.38,
    semanticWeight: 0.47,
    calibratedAt: '2026-05-31',
  },
  'prescription-v1': {
    profileId: 'prescription-v1',
    version: 1,
    minConfidence: 0.75,
    medicalMinConfidence: 0.75,
    minEvidenceLevel: 'L2',
    lexicalWeight: 0.42,
    semanticWeight: 0.38,
    calibratedAt: '2026-05-31',
  },
  'emergency-v1': {
    profileId: 'emergency-v1',
    version: 1,
    minConfidence: 0.6,
    medicalMinConfidence: 0.58,
    minEvidenceLevel: 'L1',
    lexicalWeight: 0.28,
    semanticWeight: 0.57,
    calibratedAt: '2026-05-31',
  },
  'disease-analysis-v1': {
    profileId: 'disease-analysis-v1',
    version: 1,
    minConfidence: 0.55,
    medicalMinConfidence: 0.52,
    minEvidenceLevel: 'L2',
    lexicalWeight: 0.35,
    semanticWeight: 0.5,
    calibratedAt: '2026-05-31',
  },
  'ai-doctor-v1': {
    profileId: 'ai-doctor-v1',
    version: 2,
    minConfidence: 0.55,
    medicalMinConfidence: 0.52,
    minEvidenceLevel: 'L2',
    lexicalWeight: 0.35,
    semanticWeight: 0.5,
    calibratedAt: '2026-05-31',
  },
  'feed-advisor-v1': {
    profileId: 'feed-advisor-v1',
    version: 1,
    minConfidence: 0.55,
    medicalMinConfidence: 0.55,
    minEvidenceLevel: 'L2',
    lexicalWeight: 0.42,
    semanticWeight: 0.43,
    calibratedAt: '2026-05-31',
  },
};

export function applyMedicalConfidenceCalibration(profile: RetrievalProfile): RetrievalProfile {
  const calibration = MEDICAL_CONFIDENCE_CALIBRATION[profile.profileId];
  if (!calibration) return profile;

  return {
    ...profile,
    minConfidence: calibration.minConfidence,
    medicalMinConfidence: calibration.medicalMinConfidence,
    minEvidenceLevel: calibration.minEvidenceLevel,
    lexicalWeight: calibration.lexicalWeight,
    semanticWeight: calibration.semanticWeight,
  };
}

export function resolveCalibratedRetrievalProfile(params: {
  taskType: RetrievalProfile['taskType'];
  profileId?: string;
}): RetrievalProfile {
  const base = resolveRetrievalProfile(params);
  return applyMedicalConfidenceCalibration(base);
}

export function getCalibratedProfile(profileId: string): RetrievalProfile {
  const base = RETRIEVAL_PROFILES[profileId];
  if (!base) return applyMedicalConfidenceCalibration(RETRIEVAL_PROFILES['farmer-chat-v1']!);
  return applyMedicalConfidenceCalibration(base);
}
