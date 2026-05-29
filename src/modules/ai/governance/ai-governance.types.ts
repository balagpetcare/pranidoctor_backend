export const AI_GOVERNANCE_SCOPE_ID = 'global' as const;

export type AiGovernanceSource =
  | 'admin_ui'
  | 'internal_api'
  | 'startup_sync'
  | 'redis_sync'
  | 'poll_sync'
  | 'env_override'
  | 'rollback_job'
  | 'migration_seed';

export interface AiGovernanceStateDto {
  llmDisabled: boolean;
  version: number;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByRole: string | null;
  reason: string | null;
  source: string;
}

export interface AiGovernanceHistoryDto {
  id: string;
  llmDisabled: boolean;
  previousLlmDisabled: boolean;
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

export interface AiGovernancePubSubMessage {
  version: number;
  llmDisabled: boolean;
  at: string;
}
