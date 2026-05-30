import { estimateLlmConfidence } from '../orchestrator/confidence.util.js';
import type {
  AiCompletionInput,
  AiCompletionOutput,
  AiProviderAdapter,
  AiProviderName,
} from '../orchestrator/provider.interface.js';
import type { AiChatOutput } from './core/ai-provider.types.js';
import { ensureAiProvidersBootstrapped } from './provider-factory.js';
import { getAiProviderRegistry } from './provider-registry.js';

function mapChatToCompletion(
  input: AiCompletionInput,
  result: AiChatOutput,
  legacyName: AiProviderName,
): AiCompletionOutput {
  const content =
    result.content.trim() ||
    (input.locale === 'bn'
      ? 'দুঃখিত, উত্তর তৈরি করা যায়নি। চিকিৎসকের সাথে যোগাযোগ করুন।'
      : 'Sorry, could not generate a response. Please contact a veterinarian.');

  return {
    content,
    confidence: estimateLlmConfidence(content, result.inputTokens),
    provider: legacyName,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
  };
}

/** Bridges IAIProvider → legacy AiProviderAdapter for orchestrator compatibility. */
export function createOrchestratorAdapter(legacyName: 'openai' | 'anthropic'): AiProviderAdapter {
  ensureAiProvidersBootstrapped();
  const provider = getAiProviderRegistry().getOrThrow(legacyName);

  return {
    name: legacyName,
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

      const result = await provider.chat(chatInput);
      return mapChatToCompletion(input, result, legacyName);
    },
  };
}
