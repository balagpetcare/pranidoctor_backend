export type AiProviderName = 'openai' | 'anthropic' | 'rules-based';

export interface AiCompletionInput {
  feature: string;
  systemPrompt: string;
  userMessage: string;
  locale: 'bn' | 'en';
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompletionOutput {
  content: string;
  confidence: number;
  provider: AiProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AiProviderAdapter {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(input: AiCompletionInput): Promise<AiCompletionOutput>;
}
