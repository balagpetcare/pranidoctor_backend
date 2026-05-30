import type { AiProviderCapability } from '../../providers/core/ai-provider.types.js';
import { AI_ADAPTER_TYPES } from '../marketplace.types.js';
import {
  DynamicOpenAiCompatibleProvider,
  type DynamicProviderOptions,
} from './dynamic-openai.provider.js';

/** Ollama, vLLM, LM Studio, and other self-hosted OpenAI-compatible endpoints. */
export class SelfHostedLlmProvider extends DynamicOpenAiCompatibleProvider {
  constructor(options: Omit<DynamicProviderOptions, 'capabilities'> & { capabilities?: readonly AiProviderCapability[] }) {
    super({
      ...options,
      runtimeConfig: {
        ...options.runtimeConfig,
        adapterType: AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI,
        baseUrl: options.runtimeConfig.baseUrl.replace(/\/$/, ''),
      },
      capabilities: options.capabilities ?? ['chat', 'embeddings'],
    });
  }
}

export function createSelfHostedProvider(options: {
  providerKey?: string;
  displayName?: string;
  baseUrl?: string;
  chatModel?: string;
  secretProviderKey?: string;
}): SelfHostedLlmProvider {
  const key = options.providerKey ?? 'self_hosted';
  return new SelfHostedLlmProvider({
    key,
    displayName: options.displayName ?? 'Self-hosted LLM',
    secretProviderKey: options.secretProviderKey ?? key,
    runtimeConfig: {
      adapterType: AI_ADAPTER_TYPES.SELF_HOSTED_OPENAI,
      authHeader: 'bearer',
      baseUrl: options.baseUrl ?? process.env.SELF_HOSTED_LLM_BASE_URL ?? 'http://localhost:11434/v1',
      chatModel: options.chatModel ?? process.env.SELF_HOSTED_LLM_MODEL ?? 'llama3.2',
      visionModel: options.chatModel ?? process.env.SELF_HOSTED_LLM_MODEL ?? 'llama3.2',
      embeddingModel: process.env.SELF_HOSTED_EMBEDDING_MODEL ?? 'nomic-embed-text',
    },
  });
}
