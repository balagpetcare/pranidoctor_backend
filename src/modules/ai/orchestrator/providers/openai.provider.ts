import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from '../provider.interface.js';
import { getAiPlatformConfig } from '../../config/ai.config.js';
import { estimateLlmConfidence } from '../confidence.util.js';

export class OpenAiProvider implements AiProviderAdapter {
  readonly name = 'openai' as const;

  isConfigured(): boolean {
    return Boolean(getAiPlatformConfig().openaiApiKey);
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    const config = getAiPlatformConfig();
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = config.openaiModel;
    const start = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 800,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content =
      json.choices?.[0]?.message?.content?.trim() ||
      (input.locale === 'bn'
        ? 'দুঃখিত, উত্তর তৈরি করা যায়নি। চিকিৎসকের সাথে যোগাযোগ করুন।'
        : 'Sorry, could not generate a response. Please contact a veterinarian.');

    const inputTokens = json.usage?.prompt_tokens ?? 0;
    return {
      content,
      confidence: estimateLlmConfidence(content, inputTokens),
      provider: this.name,
      model,
      inputTokens,
      outputTokens: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - start,
    };
  }
}
