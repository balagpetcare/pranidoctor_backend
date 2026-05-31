import { estimateLlmConfidence } from '../orchestrator/confidence.util.js';
import type {
  AiCompletionInput,
  AiCompletionOutput,
  AiProviderAdapter,
} from '../orchestrator/provider.interface.js';
import type { AiChatOutput, AiProviderKey } from './core/ai-provider.types.js';
import { ensureAiProvidersBootstrapped } from './provider-factory.js';
import { getAiProviderRegistry } from './provider-registry.js';

function normalizeRegistryKey(providerKey: string): AiProviderKey {
  return providerKey.replace(/-/g, '_') as AiProviderKey;
}

function adapterDisplayName(providerKey: string): string {
  return providerKey.replace(/_/g, '-');
}

function mapChatToCompletion(
  input: AiCompletionInput,
  result: AiChatOutput,
  providerKey: string,
): AiCompletionOutput {
  const content =
    result.content.trim() ||
    (input.locale === 'bn'
      ? 'দুঃখিত, উত্তর তৈরি করা যায়নি। চিকিৎসকের সাথে যোগাযোগ করুন।'
      : 'Sorry, could not generate a response. Please contact a veterinarian.');

  return {
    content,
    confidence: estimateLlmConfidence(content, result.inputTokens),
    provider: adapterDisplayName(providerKey),
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
  };
}

/** Bridges IAIProvider → legacy AiProviderAdapter for orchestrator compatibility. */
export function createOrchestratorAdapterFromKey(providerKey: string): AiProviderAdapter {
  ensureAiProvidersBootstrapped();
  const registryKey = normalizeRegistryKey(providerKey);
  const provider = getAiProviderRegistry().getOrThrow(registryKey);
  const displayName = adapterDisplayName(registryKey);

  return {
    name: displayName,
    isConfigured: () => provider.isConfigured(),
    complete: async (input: AiCompletionInput): Promise<AiCompletionOutput> => {
      const chatInput: Parameters<typeof provider.chat>[0] = {
        feature: input.feature,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userMessage },
        ],
      };
      if (input.locale) chatInput.locale = input.locale;
      if (input.maxTokens != null) chatInput.maxTokens = input.maxTokens;
      if (input.temperature != null) chatInput.temperature = input.temperature;
      if (input.resolvedModelKey) chatInput.model = input.resolvedModelKey;

      const result = await provider.chat(chatInput);
      return mapChatToCompletion(input, result, registryKey);
    },
  };
}

/** @deprecated Use createOrchestratorAdapterFromKey */
export function createOrchestratorAdapter(legacyName: 'openai' | 'anthropic'): AiProviderAdapter {
  return createOrchestratorAdapterFromKey(legacyName);
}

export const REGISTRY_PROVIDER_KEYS = [
  'openai',
  'anthropic',
  'gemini',
  'grok',
  'deepseek',
  'openrouter',
  'self_hosted',
] as const;
