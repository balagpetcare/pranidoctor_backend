export type AiProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'grok'
  | 'deepseek'
  | 'openrouter'
  | 'self_hosted'
  | (string & {});

export type AiProviderCapability = 'chat' | 'vision' | 'embeddings';

export type AiChatMessageRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatMessageRole;
  content: string;
}

export interface AiChatInput {
  feature: string;
  messages: AiChatMessage[];
  locale?: 'bn' | 'en';
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiChatOutput {
  content: string;
  model: string;
  provider: AiProviderKey;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AiVisionImage {
  /** Base64 data (no data-uri prefix) or HTTPS URL */
  data: string;
  mimeType: string;
  mediaType: 'base64' | 'url';
}

export interface AiVisionInput {
  feature: string;
  prompt: string;
  images: AiVisionImage[];
  locale?: 'bn' | 'en';
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiVisionOutput {
  content: string;
  model: string;
  provider: AiProviderKey;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AiEmbedInput {
  feature: string;
  texts: string[];
  model?: string;
}

export interface AiEmbedOutput {
  embeddings: number[][];
  model: string;
  provider: AiProviderKey;
  dimensions: number;
  totalTokens: number;
  latencyMs: number;
}

export interface AiProviderHealthResult {
  provider: AiProviderKey;
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  capabilities: Record<AiProviderCapability, boolean>;
  errorCode?: string;
  message?: string;
}

export interface DiscoveredProvider {
  key: AiProviderKey;
  displayName: string;
  configured: boolean;
  capabilities: AiProviderCapability[];
  liveCapabilities: Record<AiProviderCapability, boolean>;
  adapterType: string;
  baseUrl: string;
  models: {
    chat: string;
    vision: string;
    embedding: string;
  };
  health?: AiProviderHealthResult;
}

export interface ProviderRuntimeConfig {
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  adapterType: string;
  authHeader?: 'bearer' | 'x-api-key' | 'google-api-key';
  extraHeaders?: Record<string, string>;
}
