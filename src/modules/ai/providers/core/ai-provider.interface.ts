import type {
  AiChatInput,
  AiChatOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiProviderCapability,
  AiProviderHealthResult,
  AiProviderKey,
  AiVisionInput,
  AiVisionOutput,
} from './ai-provider.types.js';

/** Unified LLM provider contract — chat, vision, embeddings, health. */
export interface IAIProvider {
  readonly key: string;
  readonly displayName: string;
  readonly capabilities: readonly AiProviderCapability[];
  readonly adapterType: string;

  isConfigured(): boolean;
  chat(input: AiChatInput): Promise<AiChatOutput>;
  vision(input: AiVisionInput): Promise<AiVisionOutput>;
  embed(input: AiEmbedInput): Promise<AiEmbedOutput>;
  healthCheck(): Promise<AiProviderHealthResult>;
}
