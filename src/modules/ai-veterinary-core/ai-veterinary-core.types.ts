import type {
  AiEscalationReason,
  AiEscalationStatus,
  AiMemoryKind,
  AiMessageRole,
  AiRiskBucket,
} from '../../generated/prisma/index.js';
import type { AiComplianceMetadata } from '../ai/compliance/ai-compliance.types.js';

export type AiLocale = 'bn' | 'en';

/** Optional fields when AI safety recommends or records human escalation — see ai-escalation-disclosure plan */
export type EscalationDisclosureResponseFields = {
  escalationDisclosure?: string;
  escalationTrigger?: string;
  escalationDisclosureVersion?: string;
};

export type AiChatRequest = {
  message: string;
  sessionId?: string;
  caseId?: string;
  locale?: AiLocale;
};

export type AiTriageResponse = {
  triageId: string;
  riskBucket: AiRiskBucket;
  urgencyLevel: number;
  emergency: boolean;
  recommendation: string;
  escalationRequired: boolean;
  escalationId?: string;
  disclaimer: string;
  compliance?: AiComplianceMetadata;
} & EscalationDisclosureResponseFields;

export type AiChatResponse = {
  sessionId: string;
  messageId: string;
  content: string;
  refused: boolean;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  disclaimer: string;
  compliance?: AiComplianceMetadata;
} & EscalationDisclosureResponseFields;
export type AiTriageRequest = {
  sessionId?: string;
  caseId?: string;
  symptoms: string[];
  historySummary?: string;
  mediaMetadata?: Record<string, unknown>[];
  locale?: AiLocale;
};

export type AiMemoryEntry = {
  id: string;
  kind: AiMemoryKind;
  key: string;
  value: unknown;
  expiresAt: string | null;
  updatedAt: string;
};

export type AiMemoryQuery = {
  kind?: AiMemoryKind;
  key?: string;
};

export type AiMemoryDeleteQuery = {
  kind?: AiMemoryKind;
  key?: string;
  all?: boolean;
};

export type AiEscalateRequest = {
  sessionId?: string;
  caseId?: string;
  reason: AiEscalationReason;
  handoffNote?: string;
  locale?: AiLocale;
};

export type AiEscalationDto = {
  id: string;
  reason: AiEscalationReason;
  status: AiEscalationStatus;
  caseId: string | null;
  sessionId: string | null;
  handoffNote: string | null;
  flaggedAt: string;
} & EscalationDisclosureResponseFields;

export type AiHistoryMessageDto = {
  id: string;
  role: AiMessageRole;
  content: string;
  refused: boolean;
  createdAt: string;
};

export type AiHistoryResponse = {
  sessionId: string | null;
  messages: AiHistoryMessageDto[];
};

export const AI_DISCLAIMER = {
  bn: 'এটি শিক্ষামূলক সহায়তা মাত্র — চিকিৎসা সিদ্ধান্তের জন্য প্রাণী চিকিৎসকের পরামর্শ নিন।',
  en: 'This is educational guidance only — consult a veterinarian for medical decisions.',
} as const;

export const AI_MEMORY_TTL_DAYS: Record<AiMemoryKind, number> = {
  CONVERSATION: 30,
  CASE_CONTEXT: 7,
  PREFERENCE: 90,
};

export type AiProviderInput = {
  message: string;
  locale: AiLocale;
  contextSummary?: string;
};

export type AiProviderOutput = {
  content: string;
  confidence: number;
};
