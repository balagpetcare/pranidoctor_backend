import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from '../provider.interface.js';
import { getAiPlatformConfig } from '../../config/ai.config.js';
import { estimateLlmConfidence } from '../confidence.util.js';

export class AnthropicProvider implements AiProviderAdapter {
  readonly name = 'anthropic' as const;

  isConfigured(): boolean {
    return Boolean(getAiPlatformConfig().anthropicApiKey);
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    const config = getAiPlatformConfig();
    const apiKey = config.anthropicApiKey;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const model = config.anthropicModel;
    const start = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 800,
        temperature: input.temperature ?? 0.4,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content =
      json.content?.find((c) => c.type === 'text')?.text?.trim() ||
      (input.locale === 'bn'
        ? 'দুঃখিত, উত্তর তৈরি করা যায়নি। চিকিৎসকের সাথে যোগাযোগ করুন।'
        : 'Sorry, could not generate a response. Please contact a veterinarian.');

    const inputTokens = json.usage?.input_tokens ?? 0;
    return {
      content,
      confidence: estimateLlmConfidence(content, inputTokens),
      provider: this.name,
      model,
      inputTokens,
      outputTokens: json.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  }
}
