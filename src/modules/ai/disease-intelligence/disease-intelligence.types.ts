import type {
  DiCaseSessionState,
  DiDiseaseCategory,
  DiNotifiableClass,
  DiSafetyDecisionAction,
  DiVetReviewStatus,
  LivestockSpecies,
} from '../../../generated/prisma/index.js';
import type { GroundedDifferential } from '../ai-doctor/ai-doctor.types.js';

export type DiePersona = 'farmer' | 'paravet' | 'vet';

export type DiseaseRegistryView = {
  id: string;
  code: string;
  slug: string;
  labelBn: string;
  labelEn: string;
  category: DiDiseaseCategory;
  notifiableClass: DiNotifiableClass;
  zoonoticRisk: boolean;
  status: string;
  vkEntityId: string | null;
  species: LivestockSpecies[];
};

export type SafetyDecision = {
  action: DiSafetyDecisionAction;
  reasonCodes: string[];
  messages: { bn: string; en: string };
  blockLlm: boolean;
  requireEscalation: boolean;
};

export type DifferentialComputeInput = {
  symptomCodes: string[];
  species: LivestockSpecies;
  locale: 'bn' | 'en';
  divisionId?: string;
  caseId?: string;
  persona?: DiePersona;
};

export type DifferentialComputeResult = {
  runId: string;
  differentials: GroundedDifferential[];
  modelVersion: string;
};

export type DieCaseContext = {
  caseId: string;
  userId: string;
  species: LivestockSpecies;
  locale: 'bn' | 'en';
  state: DiCaseSessionState;
  symptomCodes: string[];
};

export type VetReviewQueueItem = {
  id: string;
  caseId: string;
  status: DiVetReviewStatus;
  createdAt: Date;
};
