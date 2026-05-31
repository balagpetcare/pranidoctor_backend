import type { ConfidenceRoutingAction } from '../knowledge-retrieval.types.js';
import type { GoldenQuery } from './golden-set.eval.js';

export type GoldenEvalTier = 'G0' | 'G1' | 'G2' | 'G3';
export type GoldenEvalBank = 'BL' | 'SY' | 'EM' | 'MD' | 'VC';
export type GseDimension =
  | 'retrieval'
  | 'grounding'
  | 'citation'
  | 'safety'
  | 'confidence'
  | 'veterinary';

export type ExpectedAnswerSpec = {
  answerType?: string;
  locale?: 'bn' | 'en';
  mustIncludeBn?: string[];
  mustIncludeEn?: string[];
  mustNotInclude?: string[];
  disclaimerRequired?: boolean;
  farmerSafeSummaryRequired?: boolean;
  maxClinicalAssertiveness?: 'SUGGESTIVE' | 'PROBABLE' | 'DEFINITIVE';
  structuredFactsRequired?: boolean;
};

export type ExpectedCitationSpec = {
  minCount?: number;
  maxTrustTier?: number;
  sourceKeys?: string[];
  entities?: Array<{ slug: string; minGrade?: 2 | 3; chunkIndex?: number }>;
  inlineCitationInPack?: boolean;
  pageOrSectionRequired?: boolean;
};

export type ExpectedEscalationSpec = {
  routing?: ConfidenceRoutingAction | string;
  channel?:
    | 'NONE'
    | 'CALL_VET'
    | 'CLINIC'
    | 'EMERGENCY_HOTLINE'
    | 'BOOK_VET'
    | 'ASYNC_VET_REVIEW'
    | 'REGULATORY_REFERRAL';
  vetRequiredWithinHours?: number;
  escalationCardRequired?: boolean;
  emptyPackMustBlock?: boolean;
};

export type ExpectedConfidenceSpec = {
  pack?: { min: number; max: number };
  chunksTop4?: { min: number; max: number };
  minEvidenceLevel?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  allowProvisional?: boolean;
};

export type GoldenEvalRecord = GoldenQuery & {
  bank?: GoldenEvalBank;
  version?: string;
  species?: string;
  regionScope?: 'BD' | 'GLOBAL';
  symptomCodes?: string[];
  durationDays?: number;
  severity?: 'MILD' | 'MODERATE' | 'SEVERE';
  expectedAnswer?: ExpectedAnswerSpec;
  expectedCitations?: ExpectedCitationSpec;
  expectedEscalation?: ExpectedEscalationSpec;
  expectedConfidence?: ExpectedConfidenceSpec;
  requiredStructuredFacts?: string[];
  relevantEntities?: Array<{ entitySlug: string; minGrade?: 2 | 3 }>;
  corpusDependency?: string[];
};

export type DimensionScore = {
  dimension: GseDimension;
  score: number;
  passed: boolean;
  weight: number;
  violations: string[];
  metrics: Record<string, number | boolean | string>;
};

export type GseEvalResult = {
  queryId: string;
  passed: boolean;
  compositeScore: number;
  dimensions: DimensionScore[];
  violations: string[];
  routingMatch: boolean;
  actualRouting: string;
  expectedRouting: string;
  precisionAt4: number;
  recallAt10: number;
};

export type GseEvalSummary = {
  total: number;
  passed: number;
  passRate: number;
  avgCompositeScore: number;
  avgPrecisionAt4: number;
  avgRecallAt10: number;
  dimensionAverages: Record<GseDimension, number>;
  routingAccuracy: number;
  blockCorrect: number;
  blockTotal: number;
};

export type GseCompositeScores = {
  retrievalScore: number;
  groundingScore: number;
  citationScore: number;
  safetyScore: number;
  confidenceScore: number;
  veterinaryScore: number;
  productionReadinessScore: number;
};

export const GSE_DIMENSION_WEIGHTS: Record<GseDimension, number> = {
  retrieval: 0.2,
  grounding: 0.15,
  citation: 0.15,
  safety: 0.2,
  confidence: 0.15,
  veterinary: 0.15,
};

export function normalizeGoldenRecord(query: GoldenQuery | GoldenEvalRecord): GoldenEvalRecord {
  const record = query as GoldenEvalRecord;
  const expectedRouting = query.expectedRouting;
  return {
    ...query,
    expectedEscalation: record.expectedEscalation ?? { routing: expectedRouting },
    expectedConfidence: record.expectedConfidence ?? {
      pack: { min: 0.35, max: 0.98 },
      chunksTop4: { min: 0.35, max: 1.0 },
    },
    expectedCitations: record.expectedCitations ?? {
      minCount: query.intent === 'medical' ? 1 : 0,
      inlineCitationInPack: query.intent === 'medical',
    },
    expectedAnswer: record.expectedAnswer ?? {
      disclaimerRequired: query.intent === 'medical' || query.intent === 'prescription',
      maxClinicalAssertiveness: 'SUGGESTIVE',
    },
  };
}
