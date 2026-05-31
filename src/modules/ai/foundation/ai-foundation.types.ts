import type { AiDbTaskType } from '../routing/ai-task.types.js';

export type AiFoundationLocale = 'bn' | 'en';

export type AiFoundationScope = {
  scopeKey?: string;
  tenantId?: string;
  branchId?: string;
};

export interface AiTaskRequest {
  /** Product feature key for billing and governance. */
  feature: string;
  /** Route task type — normalized to DB enum when omitted. */
  taskType?: string;
  locale: AiFoundationLocale;
  systemPrompt: string;
  userMessage: string;
  userId?: string;
  customerId?: string;
  sessionId?: string;
  scope?: AiFoundationScope;
  maxTokens?: number;
  temperature?: number;
  promptId?: string;
}

export interface AiTaskUsageDto {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface AiTaskTraceDto {
  requestId: string;
  correlationId?: string;
  routeId?: string;
  providerId?: string;
  modelId?: string;
  taskType?: AiDbTaskType;
  isFallback: boolean;
}

export interface AiTaskResult {
  content: string;
  confidence: number;
  provider: string;
  model: string;
  usage: AiTaskUsageDto;
  trace: AiTaskTraceDto;
}

export interface AiPromptTaskRequest {
  promptKey: string;
  userMessage: string;
  locale: AiFoundationLocale;
  feature: string;
  taskType?: string;
  userId?: string;
  customerId?: string;
  sessionId?: string;
  scope?: AiFoundationScope;
  context?: Record<string, string>;
}

export interface AiFoundationStatusDto {
  registryOrchestratorEnabled: boolean;
  honorDbRoutes: boolean;
  dualUsageWrite: boolean;
  settingsSource: 'database' | 'environment';
  providerCount: number;
  routeCount: number;
  checkedAt: string;
}
