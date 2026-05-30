import type { AiGovernanceScopeSnapshot, AiGovernanceScopeType } from './ai-governance.scopes.js';

export const AI_GOVERNANCE_SCOPE_ID = 'global' as const;

export type AiGovernanceSource =
  | 'admin_ui'
  | 'internal_api'
  | 'startup_sync'
  | 'redis_sync'
  | 'poll_sync'
  | 'env_override'
  | 'rollback_job'
  | 'migration_seed'
  | 'failed_attempt';

export type AiGovernanceChangeKind = 'global' | 'feature' | 'provider' | 'failed_attempt';

export interface AiGovernanceStateDto {
  llmDisabled: boolean;
  version: number;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByRole: string | null;
  reason: string | null;
  source: string;
  environment: string;
  scopes: AiGovernanceScopeSnapshot;
}

export interface AiGovernanceHistoryDto {
  id: string;
  changeKind: AiGovernanceChangeKind;
  llmDisabled: boolean;
  previousLlmDisabled: boolean;
  scopeType: string | null;
  scopeId: string | null;
  disabled: boolean | null;
  previousDisabled: boolean | null;
  version: number;
  actorId: string | null;
  actorRole: string | null;
  reason: string | null;
  source: string;
  requestId: string | null;
  correlationId: string | null;
  rollbackOfId: string | null;
  createdAt: string;
}

export interface AiGovernancePanelDto {
  escalations: unknown[];
  governance: AiGovernanceStateDto;
  history: AiGovernanceHistoryDto[];
}

export interface SetAiGovernanceParams {
  llmDisabled: boolean;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  source: AiGovernanceSource;
  expectedVersion?: number;
  rollbackOfId?: string;
  requestId?: string;
  correlationId?: string;
}

export interface SetAiGovernanceScopeParams {
  scopeType: AiGovernanceScopeType;
  scopeId: string;
  disabled: boolean;
  reason?: string;
  actorId?: string;
  actorRole?: string;
  source: AiGovernanceSource;
  expectedVersion?: number;
  rollbackOfId?: string;
  requestId?: string;
  correlationId?: string;
}

export interface AiGovernanceScopeUpdateInput {
  scopeType: AiGovernanceScopeType;
  scopeId: string;
  disabled: boolean;
}

export interface AiGovernancePubSubMessage {
  version: number;
  llmDisabled: boolean;
  at: string;
  scopes?: AiGovernanceScopeSnapshot;
}
