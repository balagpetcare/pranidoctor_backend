export type AiProviderName = string;

export interface AiCompletionInput {
  feature: string;
  systemPrompt: string;
  userMessage: string;
  locale: 'bn' | 'en';
  maxTokens?: number;
  temperature?: number;
  taskType?: string;
  scopeKey?: string;
  tenantId?: string;
  branchId?: string;
  sessionId?: string;
  promptId?: string;
  requestId?: string;
  correlationId?: string;
  /** Registry-resolved model key from AiRouterEngine — adapters must prefer over env defaults. */
  resolvedModelKey?: string;
  resolvedModelId?: string;
  hopIndex?: number;
}

export interface AiCompletionTrace {
  routeId?: string;
  providerId?: string;
  modelId?: string;
  isFallback?: boolean;
}

export interface AiCompletionOutput {
  content: string;
  confidence: number;
  provider: AiProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  trace?: AiCompletionTrace;
  usage?: { costUsd: number };
}

export interface AiProviderAdapter {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(input: AiCompletionInput): Promise<AiCompletionOutput>;
}
