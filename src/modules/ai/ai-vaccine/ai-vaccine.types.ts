import type { LivestockSpecies } from '../../../generated/prisma/index.js';
import type {
  KnowledgeContextPack,
  StructuredFact,
} from '../knowledge-retrieval/knowledge-retrieval.types.js';
import type { InlineCitation } from './engines/vaccine-metadata.util.js';

export type VaccineLocale = 'bn' | 'en';

export type VaccineAccessMode = 'FARMER_GUIDANCE' | 'VET_HERD_REVIEW';

export type VaccineSessionState =
  | 'CREATED'
  | 'INTAKE'
  | 'ANALYZING'
  | 'RESPONSE_DELIVERED'
  | 'BLOCKED'
  | 'ESCALATED';

export type SafetyRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type ConfidenceTier = 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';

export type EscalationType =
  | 'VET_CALL_NOW'
  | 'VET_BOOKING'
  | 'ASYNC_VET_REVIEW'
  | 'FIELD_AGENT';

export type EligibilityStatus =
  | 'NOT_ELIGIBLE'
  | 'APPROACHING'
  | 'IN_WINDOW'
  | 'OVERDUE_PRIMARY'
  | 'UNKNOWN';

export type VaccineMatch = {
  entityId: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  antigen?: string;
  entityType: string;
  confidenceScore: number;
  citations: InlineCitation[];
};

export type VaccineReferenceCard = {
  slug: string;
  titleBn: string;
  titleEn: string;
  antigen?: string;
  route?: string;
  doseMl?: number;
  storageTempC?: number;
  species: LivestockSpecies[];
  summaryBn: string;
  summaryEn: string;
  citations: InlineCitation[];
};

export type ScheduleRow = {
  slug: string;
  titleBn: string;
  titleEn: string;
  antigen?: string;
  ageWindow?: string;
  boosterIntervalDays?: number;
  route?: string;
  citations: InlineCitation[];
  confidenceScore: number;
};

export type EligibilityResult = {
  status: EligibilityStatus;
  scheduleSlug: string;
  ageDays?: number;
  ageWindowDisplayBn: string;
  citations: InlineCitation[];
  confidenceScore: number;
  vetConfirmRequired: boolean;
};

export type BoosterStatus = {
  vaccineSlug: string;
  antigen?: string;
  lastAdministeredDate?: string;
  nextDueDate?: string;
  dueInDays?: number;
  overdue: boolean;
  boosterIntervalDays?: number;
  citations: InlineCitation[];
  confidenceScore: number;
};

export type MissedVaccineAlert = {
  vaccinationRecordId: string;
  vaccineName: string;
  scheduledDate: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  messageBn: string;
  messageEn: string;
  scheduleSlug?: string;
  citations: InlineCitation[];
};

export type VaccinationReminder = {
  id: string;
  livestockId?: string;
  scheduleSlug: string;
  dueDate: string;
  channel: 'IN_APP' | 'PUSH' | 'SMS';
  messageBn: string;
  messageEn: string;
  citations: InlineCitation[];
  confidenceTier: ConfidenceTier;
  safetyFooterBn: string;
};

export type VaccineVaccineConflict = {
  vaccineA: string;
  vaccineB: string;
  minDaysBetween: number;
  severity: 'MODERATE' | 'SEVERE';
  noteBn: string;
  noteEn: string;
  citations: InlineCitation[];
};

export type VaccineInteractionReport = {
  vaccineConflicts: VaccineVaccineConflict[];
  medicineConflicts: Array<{
    medicineSlug: string;
    vaccineSlug: string;
    conflictType: string;
    severity: string;
    recommendedWindowBn: string;
    recommendedWindowEn: string;
    citations: InlineCitation[];
  }>;
  overallRisk: SafetyRiskLevel;
};

export type SafetyWarning = {
  code: string;
  severity: 'INFO' | 'CAUTION' | 'HIGH' | 'CRITICAL';
  messageBn: string;
  messageEn: string;
};

export type SafetyMessagingBlock = {
  disclaimerBn: string;
  disclaimerEn: string;
  vetSupervisionBn: string;
  vetSupervisionEn: string;
  notDiagnosisBn: string;
  notDiagnosisEn: string;
};

export type VaccineSafetyReport = {
  reportId: string;
  overallRisk: SafetyRiskLevel;
  safetyClassification: SafetyRiskLevel;
  warnings: SafetyWarning[];
  eligibility: EligibilityResult[];
  missedAlerts: MissedVaccineAlert[];
  interactions?: VaccineInteractionReport;
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

export type AiVaccineSession = {
  id: string;
  userId: string;
  customerId?: string;
  sessionId?: string;
  mode: VaccineAccessMode;
  species: LivestockSpecies;
  locale: VaccineLocale;
  state: VaccineSessionState;
  pregnancy: boolean;
  livestockId?: string;
  ageDays?: number;
  vaccineSlugs: string[];
  medicineSlugs: string[];
  lastPackId?: string;
  lastSafetyReportId?: string;
  escalationIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateVaccineSessionInput = {
  userId: string;
  customerId?: string;
  species: LivestockSpecies;
  locale?: VaccineLocale;
  mode?: VaccineAccessMode;
  livestockId?: string;
  pregnancy?: boolean;
  ageDays?: number;
};

export type VaccineAnalyzeInput = {
  message?: string;
  query?: string;
  vaccineSlugs?: string[];
  medicineSlugs?: string[];
};

export type VaccineAssistantResponseEnvelope = {
  citations: InlineCitation[];
  confidence: SessionConfidence;
  safetyMessaging: SafetyMessagingBlock;
};

export type VaccineAnalyzeResult = {
  session: AiVaccineSession;
  refused: boolean;
  content: string;
  vaccineMatches: VaccineMatch[];
  referenceCards: VaccineReferenceCard[];
  schedules: ScheduleRow[];
  eligibility: EligibilityResult[];
  boosters: BoosterStatus[];
  missedAlerts: MissedVaccineAlert[];
  reminders: VaccinationReminder[];
  interactions?: VaccineInteractionReport;
  safetyReport: VaccineSafetyReport;
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
  safetyMessaging: SafetyMessagingBlock;
  redirectAssistant?: 'ai-doctor' | 'prescription' | 'emergency';
};

export type VaccineLookupResult = {
  matches: VaccineMatch[];
  query: string;
};

export type ScheduleRetrievalResult = {
  schedules: ScheduleRow[];
  citations: InlineCitation[];
};

export type EligibilityCheckResult = {
  results: EligibilityResult[];
  citations: InlineCitation[];
};

export type BoosterCheckResult = {
  boosters: BoosterStatus[];
  citations: InlineCitation[];
};

export type MissedVaccineResult = {
  alerts: MissedVaccineAlert[];
  citations: InlineCitation[];
};

export type ReminderRecommendationsResult = {
  reminders: VaccinationReminder[];
  citations: InlineCitation[];
};

export type VaccineInteractionCheckResult = {
  report: VaccineInteractionReport;
  citations: InlineCitation[];
  safetyClassification: SafetyRiskLevel;
};
