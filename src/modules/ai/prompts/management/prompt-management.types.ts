import type { AiPromptStatus } from '../../../../generated/prisma/index.js';

export type PromptKind = 'system' | 'feature';

export type PromptLifecycleStatus = AiPromptStatus;

export interface PromptActor {
  userId?: string;
  role?: string;
}

export interface PromptListFilters {
  scopeKey?: string;
  kind?: PromptKind;
  taskType?: string;
  status?: PromptLifecycleStatus;
  promptKey?: string;
  includeArchived?: boolean;
}

export interface CreatePromptInput {
  promptKey: string;
  name: string;
  description?: string;
  kind?: PromptKind;
  taskType?: string;
  systemBn: string;
  systemEn: string;
  userTemplateBn?: string;
  userTemplateEn?: string;
  scopeKey?: string;
  tenantId?: string;
  branchId?: string;
  trafficPercent?: number;
  variablesSchemaJson?: unknown;
  testCasesJson?: unknown;
  metadataJson?: unknown;
  actor?: PromptActor;
}

export interface UpdatePromptDraftInput {
  name?: string;
  description?: string | null;
  taskType?: string | null;
  systemBn?: string;
  systemEn?: string;
  userTemplateBn?: string | null;
  userTemplateEn?: string | null;
  trafficPercent?: number;
  variablesSchemaJson?: unknown;
  testCasesJson?: unknown;
  metadataJson?: unknown;
  actor?: PromptActor;
}

export interface PromptView {
  id: string;
  promptKey: string;
  /** @deprecated Use promptKey — kept for admin UI compatibility */
  key: string;
  name: string;
  description: string | null;
  kind: PromptKind;
  taskType: string | null;
  version: number;
  status: PromptLifecycleStatus;
  published: boolean;
  systemBn: string;
  systemEn: string;
  userTemplateBn: string | null;
  userTemplateEn: string | null;
  scopeKey: string;
  tenantId: string | null;
  branchId: string | null;
  trafficPercent: number;
  parentVersionId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedPrompt {
  id: string;
  key: string;
  promptKey: string;
  name: string;
  description: string | null;
  systemBn: string;
  systemEn: string;
  userTemplateBn: string | null;
  userTemplateEn: string | null;
  version: number;
  status: PromptLifecycleStatus;
  taskType: string | null;
  kind: PromptKind;
}

export const PLATFORM_SCOPE_KEY = 'platform';

/** Legacy runtime keys → AIMS prompt registry keys */
export const LEGACY_PROMPT_KEY_ALIASES: Record<string, string> = {
  farmer_chat: 'general_chat',
  symptom_checker: 'disease_analysis',
  farm_assistant: 'farm_assistant',
};

export const AIMS_TO_LEGACY_PROMPT_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_PROMPT_KEY_ALIASES).map(([legacy, aims]) => [aims, legacy]),
);
