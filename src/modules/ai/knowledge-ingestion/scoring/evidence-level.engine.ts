import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeContentType,
  AiKnowledgeEvidenceLevel,
  AiKnowledgeSourceClass,
} from '../../../../generated/prisma/index.js';

const LEVEL_ORDER: AiKnowledgeEvidenceLevel[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

const LEVEL_SCORE: Record<AiKnowledgeEvidenceLevel, number> = {
  L1: 0.4,
  L2: 0.7,
  L3: 0.85,
  L4: 0.95,
  L5: 1.0,
};

const SOURCE_CLASS_DEFAULT: Record<AiKnowledgeSourceClass, AiKnowledgeEvidenceLevel> = {
  VETERINARY_TEXTBOOK: 'L3',
  CLINICAL_PROTOCOL: 'L2',
  BPA_GUIDELINE: 'L2',
  WPA_GUIDELINE: 'L3',
  GOVT_LIVESTOCK: 'L2',
  VACCINE_SCHEDULE: 'L2',
  MEDICINE_REFERENCE: 'L3',
  FEED_REFERENCE: 'L3',
  BREED_REFERENCE: 'L2',
  EMERGENCY_PROTOCOL: 'L2',
};

const SOURCE_CLASS_CEILING: Record<AiKnowledgeSourceClass, AiKnowledgeEvidenceLevel> = {
  VETERINARY_TEXTBOOK: 'L3',
  CLINICAL_PROTOCOL: 'L3',
  BPA_GUIDELINE: 'L3',
  WPA_GUIDELINE: 'L4',
  GOVT_LIVESTOCK: 'L2',
  VACCINE_SCHEDULE: 'L5',
  MEDICINE_REFERENCE: 'L5',
  FEED_REFERENCE: 'L4',
  BREED_REFERENCE: 'L3',
  EMERGENCY_PROTOCOL: 'L2',
};

const CONTENT_TYPE_RISK: Partial<Record<AiKnowledgeContentType, AiKnowledgeClinicalRiskTier>> = {
  MEDICINE: 'HIGH',
  EMERGENCY: 'CRITICAL',
  DISEASE: 'MEDIUM',
  VACCINE: 'MEDIUM',
  FEED: 'MEDIUM',
  FARM_MGMT: 'LOW',
};

export function evidenceLevelScore(level: AiKnowledgeEvidenceLevel): number {
  return LEVEL_SCORE[level];
}

export function minEvidenceLevel(a: AiKnowledgeEvidenceLevel, b: AiKnowledgeEvidenceLevel): AiKnowledgeEvidenceLevel {
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function maxEvidenceLevel(a: AiKnowledgeEvidenceLevel, b: AiKnowledgeEvidenceLevel): AiKnowledgeEvidenceLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function inferClinicalRiskTier(contentType: AiKnowledgeContentType): AiKnowledgeClinicalRiskTier {
  return CONTENT_TYPE_RISK[contentType] ?? 'LOW';
}

export function assignProvisionalEvidenceLevel(params: {
  sourceClass: AiKnowledgeSourceClass;
  sourceDefaultLevel: AiKnowledgeEvidenceLevel;
  contentType: AiKnowledgeContentType;
  hasRegistrationField?: boolean;
}): AiKnowledgeEvidenceLevel {
  let level = SOURCE_CLASS_DEFAULT[params.sourceClass] ?? params.sourceDefaultLevel;
  level = minEvidenceLevel(level, params.sourceDefaultLevel);
  level = minEvidenceLevel(level, SOURCE_CLASS_CEILING[params.sourceClass]);

  if (params.hasRegistrationField) {
    level = maxEvidenceLevel(level, 'L5');
  }

  if (params.contentType === 'MEDICINE' && level === 'L3') {
    level = 'L2';
  }

  return level;
}

export function finalizeEvidenceLevel(params: {
  provisional: AiKnowledgeEvidenceLevel;
  reviewerLevel?: AiKnowledgeEvidenceLevel;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
}): AiKnowledgeEvidenceLevel {
  let level = params.reviewerLevel ?? params.provisional;

  if (params.clinicalRiskTier === 'HIGH' || params.clinicalRiskTier === 'CRITICAL') {
    level = maxEvidenceLevel(level, 'L2');
  }

  return level;
}

export function evidenceLevelBnLabel(level: AiKnowledgeEvidenceLevel): string {
  const labels: Record<AiKnowledgeEvidenceLevel, string> = {
    L1: 'বিশেষজ্ঞ ঐকমত্য',
    L2: 'মাঠ পর্যায়ে যাচাইকৃত',
    L3: 'নিয়ন্ত্রিত গবেষণা',
    L4: 'পদ্ধতিগত পর্যালোচনা',
    L5: 'নিয়ন্ত্রক প্রাথমিক উৎস',
  };
  return labels[level];
}
