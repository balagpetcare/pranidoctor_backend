import type {
  AiEscalationReason,
  AiEscalationStatus,
  AiMemoryKind,
  AiMessageRole,
  AiRiskBucket,
} from '../../generated/prisma/index.js';

export type AiLocale = 'bn' | 'en';

export type AiChatRequest = {
  message: string;
  sessionId?: string;
  caseId?: string;
  locale?: AiLocale;
};

export type AiChatResponse = {
  sessionId: string;
  messageId: string;
  content: string;
  refused: boolean;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  disclaimer: string;
};

export type AiTriageRequest = {
  sessionId?: string;
  caseId?: string;
  symptoms: string[];
  historySummary?: string;
  mediaMetadata?: Record<string, unknown>[];
  locale?: AiLocale;
};

export type AiTriageResponse = {
  triageId: string;
  riskBucket: AiRiskBucket;
  urgencyLevel: number;
  recommendation: string;
  escalationRequired: boolean;
  escalationId?: string;
  disclaimer: string;
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
};

export type AiEscalationDto = {
  id: string;
  reason: AiEscalationReason;
  status: AiEscalationStatus;
  caseId: string | null;
  sessionId: string | null;
  handoffNote: string | null;
  flaggedAt: string;
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
