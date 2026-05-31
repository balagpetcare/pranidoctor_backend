import type { AiRiskBucket, LivestockSpecies } from '../../../generated/prisma/index.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';

export type AiDoctorLocale = 'bn' | 'en';

export type AiDoctorCaseState =
  | 'CREATED'
  | 'INTAKE'
  | 'AWAITING_CLARIFICATION'
  | 'EMERGENCY_TRIAGE'
  | 'ANALYZING'
  | 'RESPONSE_DELIVERED'
  | 'BLOCKED'
  | 'ESCALATED'
  | 'CLOSED';

export type SymptomSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export type SymptomSnapshot = {
  symptomCodes: string[];
  freeTextSymptoms: string[];
  durationDays?: number;
  severity?: SymptomSeverity;
  normalizedTerms?: string[];
};

export type SymptomCompletenessScore = {
  score: number;
  requiredFieldsMet: boolean;
  missingFields: Array<'duration' | 'severity' | 'body_system' | 'progression'>;
  redFlagScreened: boolean;
};

export type ClarificationQuestion = {
  field: string;
  questionBn: string;
  questionEn: string;
};

export type RedFlagItem = {
  code: string;
  labelBn: string;
  labelEn: string;
  source: 'graph' | 'lexicon';
};

export type UrgencyTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type CaseRiskAssessment = {
  urgencyTier: UrgencyTier;
  triageBucket: AiRiskBucket;
  urgencyLevel: number;
  redFlags: RedFlagItem[];
  recommendationBn: string;
  recommendationEn: string;
  escalationRequired: boolean;
  emergency: boolean;
};

export type GroundedDifferential = {
  slug: string;
  titleBn: string;
  titleEn: string;
  rank: number;
  confidenceScore: number;
  evidenceLevel: string;
  supportingSymptoms: string[];
  citations: string[];
  source: 'graph' | 'rag' | 'fused';
  reasonCodes?: string[];
};

export type ConfidenceTier = 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';

export type CaseConfidence = {
  retrievalAvg: number;
  differentialTop: number;
  caseScore: number;
  tier: ConfidenceTier;
  failClosed: boolean;
};

export type EscalationType =
  | 'VET_CALL_NOW'
  | 'VET_BOOKING'
  | 'ASYNC_VET_REVIEW'
  | 'CLINIC_FINDER';

export type AiDoctorCase = {
  id: string;
  userId: string;
  customerId?: string;
  livestockId?: string;
  species: LivestockSpecies;
  locale: AiDoctorLocale;
  state: AiDoctorCaseState;
  sessionId?: string;
  symptomCheckSessionId?: string;
  symptomSnapshot: SymptomSnapshot;
  completeness: SymptomCompletenessScore;
  riskAssessment?: CaseRiskAssessment;
  differentials: GroundedDifferential[];
  confidence?: CaseConfidence;
  lastPackId?: string;
  escalationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateAiDoctorCaseInput = {
  userId: string;
  customerId?: string;
  livestockId?: string;
  species: LivestockSpecies;
  locale?: AiDoctorLocale;
  symptomCheckSessionId?: string;
};

export type SubmitIntakeInput = {
  symptomCodes: string[];
  freeTextSymptoms?: string[];
  durationDays?: number;
  severity?: SymptomSeverity;
};

export type AnalyzeCaseResult = {
  case: AiDoctorCase;
  refused: boolean;
  content: string;
  differentials: GroundedDifferential[];
  confidence: CaseConfidence;
  riskAssessment: CaseRiskAssessment;
  clarificationQuestions?: ClarificationQuestion[];
  emergencyHandoff?: boolean;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  pack?: KnowledgeContextPack;
  disclaimer: string;
};

export type EscalationTriggerContext = {
  urgencyTier: UrgencyTier;
  routingAction: string;
  caseConfidence: number;
  userRequested?: boolean;
  emergency: boolean;
  policyRefusal?: boolean;
};
