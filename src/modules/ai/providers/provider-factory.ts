import { AnthropicProvider } from './implementations/anthropic.provider.js';
import { GeminiProvider } from './implementations/gemini.provider.js';
import {
  DeepSeekProvider,
  GrokProvider,
  OpenAIProvider,
  OpenRouterProvider,
} from './implementations/openai-compatible.providers.js';
import { createSelfHostedProvider } from '../marketplace/adapters/self-hosted.provider.js';
import type { IAIProvider } from './core/ai-provider.interface.js';
import type { AiProviderKey } from './core/ai-provider.types.js';
import { allProviderKeys } from './provider-config.js';
import { getAiProviderRegistry } from './provider-registry.js';

const PROVIDER_CTORS: Record<string, () => IAIProvider> = {
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  gemini: () => new GeminiProvider(),
  grok: () => new GrokProvider(),
  deepseek: () => new DeepSeekProvider(),
  openrouter: () => new OpenRouterProvider(),
  self_hosted: () => createSelfHostedProvider({}),
};

export class AiProviderFactory {
  readonly name = 'AiProviderFactory';

  create(key: string): IAIProvider {
    const ctor = PROVIDER_CTORS[key as keyof typeof PROVIDER_CTORS];
    if (!ctor) {
      throw new Error(`Unknown AI provider key: ${key}`);
    }
    return ctor();
  }

  createAll(): IAIProvider[] {
    return allProviderKeys().map((key) => this.create(key));
  }

  /** Create all providers and register them in the global registry. */
  bootstrapRegistry(registry = getAiProviderRegistry()): IAIProvider[] {
    const providers = this.createAll();
    registry.registerMany(providers);
    return providers;
  }
}

let factory: AiProviderFactory | null = null;

export function getAiProviderFactory(): AiProviderFactory {
  if (!factory) factory = new AiProviderFactory();
  return factory;
}

export function resetAiProviderFactoryForTests(): void {
  factory = null;
}

/** Idempotent — ensures all built-in providers are registered once. */
let bootstrapped = false;

export function ensureAiProvidersBootstrapped(): void {
  if (bootstrapped) return;
  getAiProviderFactory().bootstrapRegistry();
  bootstrapped = true;
}

export function resetAiProviderBootstrapForTests(): void {
  bootstrapped = false;
}
