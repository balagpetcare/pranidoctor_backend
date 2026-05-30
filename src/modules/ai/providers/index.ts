export type { IAIProvider } from './core/ai-provider.interface.js';
export type {
  AiProviderKey,
  AiProviderCapability,
  AiChatInput,
  AiChatOutput,
  AiVisionInput,
  AiVisionOutput,
  AiEmbedInput,
  AiEmbedOutput,
  AiProviderHealthResult,
  DiscoveredProvider,
} from './core/ai-provider.types.js';
export { AiProviderError, AiProviderNotConfiguredError } from './core/ai-provider.errors.js';
export { OpenAiCompatibleProvider } from './core/openai-compatible.provider.js';

export { OpenAIProvider, GrokProvider, DeepSeekProvider, OpenRouterProvider } from './implementations/openai-compatible.providers.js';
export { AnthropicProvider } from './implementations/anthropic.provider.js';
export { GeminiProvider } from './implementations/gemini.provider.js';

export { AiProviderRegistry, getAiProviderRegistry, resetAiProviderRegistryForTests } from './provider-registry.js';
export {
  AiProviderFactory,
  getAiProviderFactory,
  ensureAiProvidersBootstrapped,
  resetAiProviderFactoryForTests,
  resetAiProviderBootstrapForTests,
} from './provider-factory.js';
export {
  AiProviderDiscovery,
  getAiProviderDiscovery,
  resetAiProviderDiscoveryForTests,
} from './provider-discovery.js';
export { getProviderRuntimeConfig, allProviderKeys } from './provider-config.js';
export { createOrchestratorAdapter } from './orchestrator-bridge.js';
