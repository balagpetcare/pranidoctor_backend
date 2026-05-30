import type { IAIProvider } from '../core/ai-provider.interface.js';
import { OpenAiCompatibleProvider } from '../core/openai-compatible.provider.js';
import type { AiProviderKey } from '../core/ai-provider.types.js';

export class OpenAIProvider extends OpenAiCompatibleProvider implements IAIProvider {
  readonly key: AiProviderKey = 'openai';
  readonly displayName = 'OpenAI';
}

export class GrokProvider extends OpenAiCompatibleProvider implements IAIProvider {
  readonly key: AiProviderKey = 'grok';
  readonly displayName = 'Grok (xAI)';
}

export class DeepSeekProvider extends OpenAiCompatibleProvider implements IAIProvider {
  readonly key: AiProviderKey = 'deepseek';
  readonly displayName = 'DeepSeek';
}

export class OpenRouterProvider extends OpenAiCompatibleProvider implements IAIProvider {
  readonly key: AiProviderKey = 'openrouter';
  readonly displayName = 'OpenRouter';
}
