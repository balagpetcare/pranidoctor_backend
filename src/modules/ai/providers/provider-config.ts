import { getAiPlatformConfig, resetAiPlatformConfigCache } from '../config/ai.config.js';
import type { AiProviderKey, ProviderRuntimeConfig } from './core/ai-provider.types.js';

function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

const DEFAULTS: Record<AiProviderKey, Omit<ProviderRuntimeConfig, 'adapterType' | 'authHeader'>> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    chatModel: 'gpt-4o-mini',
    visionModel: 'gpt-4o',
    embeddingModel: 'text-embedding-3-small',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    chatModel: 'claude-3-5-haiku-20241022',
    visionModel: 'claude-3-5-haiku-20241022',
    embeddingModel: 'voyage-3-lite',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    chatModel: 'gemini-1.5-flash',
    visionModel: 'gemini-1.5-flash',
    embeddingModel: 'text-embedding-004',
  },
  grok: {
    baseUrl: 'https://api.x.ai/v1',
    chatModel: 'grok-2-1212',
    visionModel: 'grok-2-vision-1212',
    embeddingModel: 'text-embedding-3-small',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    chatModel: 'deepseek-chat',
    visionModel: 'deepseek-chat',
    embeddingModel: 'deepseek-embedding',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    chatModel: 'openai/gpt-4o-mini',
    visionModel: 'openai/gpt-4o',
    embeddingModel: 'openai/text-embedding-3-small',
  },
  self_hosted: {
    baseUrl: 'http://localhost:11434/v1',
    chatModel: 'llama3.2',
    visionModel: 'llama3.2',
    embeddingModel: 'nomic-embed-text',
  },
};

export function getProviderRuntimeConfig(key: AiProviderKey): ProviderRuntimeConfig {
  resetAiPlatformConfigCache();
  const platform = getAiPlatformConfig();
  const base = DEFAULTS[key];

  switch (key) {
    case 'openai':
      return {
        ...base,
        adapterType: 'openai_native',
        authHeader: 'bearer',
        chatModel: env('OPENAI_MODEL') ?? platform.openaiModel,
        visionModel: env('OPENAI_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('OPENAI_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('OPENAI_BASE_URL') ?? base.baseUrl,
      };
    case 'anthropic':
      return {
        ...base,
        adapterType: 'anthropic_native',
        authHeader: 'x-api-key',
        chatModel: env('ANTHROPIC_MODEL') ?? platform.anthropicModel,
        visionModel: env('ANTHROPIC_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('ANTHROPIC_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('ANTHROPIC_BASE_URL') ?? base.baseUrl,
        extraHeaders: { 'anthropic-version': '2023-06-01' },
      };
    case 'gemini':
      return {
        ...base,
        adapterType: 'gemini_native',
        authHeader: 'google-api-key',
        chatModel: env('GEMINI_MODEL') ?? base.chatModel,
        visionModel: env('GEMINI_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('GEMINI_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('GEMINI_BASE_URL') ?? base.baseUrl,
      };
    case 'grok':
      return {
        ...base,
        adapterType: 'openai_compatible',
        authHeader: 'bearer',
        chatModel: env('GROK_MODEL') ?? base.chatModel,
        visionModel: env('GROK_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('GROK_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('GROK_BASE_URL') ?? base.baseUrl,
      };
    case 'deepseek':
      return {
        ...base,
        adapterType: 'openai_compatible',
        authHeader: 'bearer',
        chatModel: env('DEEPSEEK_MODEL') ?? base.chatModel,
        visionModel: env('DEEPSEEK_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('DEEPSEEK_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('DEEPSEEK_BASE_URL') ?? base.baseUrl,
      };
    case 'openrouter':
      return {
        ...base,
        adapterType: 'openrouter_gateway',
        authHeader: 'bearer',
        chatModel: env('OPENROUTER_DEFAULT_MODEL') ?? base.chatModel,
        visionModel: env('OPENROUTER_VISION_MODEL') ?? base.visionModel,
        embeddingModel: env('OPENROUTER_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('OPENROUTER_BASE_URL') ?? base.baseUrl,
        extraHeaders: {
          'HTTP-Referer': env('OPENROUTER_HTTP_REFERER') ?? 'https://pranidoctor.com',
          'X-Title': env('OPENROUTER_APP_TITLE') ?? 'Prani Doctor',
        },
      };
    case 'self_hosted':
      return {
        ...base,
        adapterType: 'self_hosted_openai',
        authHeader: 'bearer',
        chatModel: env('SELF_HOSTED_LLM_MODEL') ?? base.chatModel,
        visionModel: env('SELF_HOSTED_LLM_MODEL') ?? base.visionModel,
        embeddingModel: env('SELF_HOSTED_EMBEDDING_MODEL') ?? base.embeddingModel,
        baseUrl: env('SELF_HOSTED_LLM_BASE_URL') ?? base.baseUrl,
      };
    default:
      return { ...base, adapterType: 'unknown', authHeader: 'bearer' };
  }
}

export function allProviderKeys(): string[] {
  return ['openai', 'anthropic', 'gemini', 'grok', 'deepseek', 'openrouter', 'self_hosted'];
}
