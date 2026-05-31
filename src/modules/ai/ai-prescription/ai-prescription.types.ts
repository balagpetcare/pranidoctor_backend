import type { LivestockSpecies } from '../../../generated/prisma/index.js';
import type {
  KnowledgeContextPack,
  StructuredFact,
} from '../knowledge-retrieval/knowledge-retrieval.types.js';
import type { InlineCitation } from './engines/medicine-metadata.util.js';

export type PrescriptionLocale = 'bn' | 'en';

export type PrescriptionAccessMode = 'FARMER_REFERENCE' | 'VET_VALIDATION';

export type PrescriptionSessionState =
  | 'CREATED'
  | 'INTAKE'
  | 'ANALYZING'
  | 'RESPONSE_DELIVERED'
  | 'BLOCKED'
  | 'ESCALATED';

export type SafetyRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type ConfidenceTier = 'VERIFIED' | 'MODERATE' | 'INSUFFICIENT';

export type EscalationType =
  | 'VET_CALL_NOW'
  | 'VET_BOOKING'
  | 'ASYNC_VET_REVIEW'
  | 'REGULATORY_REFERRAL';

export type DrugMatch = {
  entityId: string;
  slug: string;
  genericName: string;
  brandNamesBd: string[];
  drugClass?: string;
  prescriptionRequired: boolean;
  confidenceScore: number;
  citations: InlineCitation[];
};

export type DrugReferenceCard = {
  slug: string;
  genericName: string;
  drugClass?: string;
  brandNamesBd: string[];
  prescriptionRequired: boolean;
  routes: string[];
  species: LivestockSpecies[];
  summaryBn: string;
  summaryEn: string;
  citations: InlineCitation[];
};

export type ContraindicationWarning = {
  severity: 'ABSOLUTE' | 'RELATIVE' | 'CAUTION';
  condition: string;
  descriptionBn: string;
  descriptionEn: string;
  citations: InlineCitation[];
  source: 'structured' | 'graph';
};

export type DrugInteraction = {
  drugA: string;
  drugB: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED';
  mechanismBn?: string;
  mechanismEn?: string;
  recommendationTier: 'MONITOR' | 'AVOID' | 'CONTRAINDICATED';
  citations: InlineCitation[];
};

export type InteractionBundle = {
  pairs: DrugInteraction[];
  unresolvedPairs: Array<{ drugA: string; drugB: string; reason: 'NO_EDGE' }>;
  overallRisk: SafetyRiskLevel;
};

export type VaccineMedicineConflict = {
  medicineSlug: string;
  vaccineSlug: string;
  conflictType: 'LIVE_VACCINE_ANTIBIOTIC' | 'IMMUNOSUPPRESSION' | 'TIMING_WINDOW' | 'CONCURRENT_ADMIN';
  severity: 'MODERATE' | 'SEVERE';
  recommendedWindowBn: string;
  recommendedWindowEn: string;
  citations: InlineCitation[];
};

export type WithdrawalPeriod = {
  productType: 'MILK' | 'MEAT' | 'EGG' | 'ORGAN';
  withdrawalDays: number;
  regulatoryBasis?: string;
  citations: InlineCitation[];
};

export type WithdrawalSummary = {
  drugSlug: string;
  species: LivestockSpecies;
  periods: WithdrawalPeriod[];
  confidenceScore: number;
};

export type SafetyWarning = {
  code: string;
  severity: 'INFO' | 'CAUTION' | 'HIGH' | 'CRITICAL';
  messageBn: string;
  messageEn: string;
  citationRequired: boolean;
};

export type PrescriptionSafetyReport = {
  reportId: string;
  overallRisk: SafetyRiskLevel;
  safetyClassification: SafetyRiskLevel;
  warnings: SafetyWarning[];
  contraindications: ContraindicationWarning[];
  interactions: DrugInteraction[];
  vaccineConflicts: VaccineMedicineConflict[];
  withdrawalSummary?: WithdrawalSummary;
  escalationRequired: boolean;
  escalationType?: EscalationType;
  blockReasons: string[];
  citations: InlineCitation[];
};

export type SessionConfidence = {
  retrievalAvg: number;
  sessionScore: number;
  tier: ConfidenceTier;
  failClosed: boolean;
};

export type AiPrescriptionSession = {
  id: string;
  userId: string;
  customerId?: string;
  sessionId?: string;
  mode: PrescriptionAccessMode;
  species: LivestockSpecies;
  locale: PrescriptionLocale;
  state: PrescriptionSessionState;
  pregnancy: boolean;
  lactating: boolean;
  ageDays?: number;
  weightKg?: number;
  drugSlugs: string[];
  vaccineSlugs: string[];
  doctorCaseId?: string;
  lastPackId?: string;
  lastSafetyReportId?: string;
  escalationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreatePrescriptionSessionInput = {
  userId: string;
  customerId?: string;
  species: LivestockSpecies;
  locale?: PrescriptionLocale;
  mode?: PrescriptionAccessMode;
  livestockId?: string;
  pregnancy?: boolean;
  lactating?: boolean;
  ageDays?: number;
  weightKg?: number;
  doctorCaseId?: string;
};

export type PrescriptionAnalyzeInput = {
  message?: string;
  drugSlugs?: string[];
  vaccineSlugs?: string[];
  query?: string;
};

export type PrescriptionAnalyzeResult = {
  session: AiPrescriptionSession;
  refused: boolean;
  content: string;
  drugMatches: DrugMatch[];
  referenceCards: DrugReferenceCard[];
  safetyReport: PrescriptionSafetyReport;
  confidence: SessionConfidence;
  citations: InlineCitation[];
  safetyClassification: SafetyRiskLevel;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  escalationType?: EscalationType;
  escalationId?: string;
  structuredFacts: StructuredFact[];
  pack?: KnowledgeContextPack;
  disclaimer: string;
};

export type MedicineLookupResult = {
  matches: DrugMatch[];
  query: string;
};

export type InteractionCheckResult = {
  bundle: InteractionBundle;
  citations: InlineCitation[];
  safetyClassification: SafetyRiskLevel;
};

export type WithdrawalLookupResult = {
  summaries: WithdrawalSummary[];
  citations: InlineCitation[];
  safetyClassification: SafetyRiskLevel;
};
