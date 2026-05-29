import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from '../provider.interface.js';

export class RulesBasedProvider implements AiProviderAdapter {
  readonly name = 'rules-based' as const;

  isConfigured(): boolean {
    return true;
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionOutput> {
    const start = Date.now();
    const content =
      input.locale === 'bn'
        ? `আপনার প্রশ্নের ভিত্তিতে সাধারণ যত্নের পরামর্শ: বিশ্রাম, পরিষ্কার পানি ও পর্যবেক্ষণ রাখুন। নিশ্চিত সিদ্ধান্তের জন্য চিকিৎসকের পরামর্শ নিন।`
        : `Based on your question, general care guidance: rest, clean water, and observation. Consult a veterinarian for confirmed decisions.`;

    return {
      content,
      confidence: 0.72,
      provider: this.name,
      model: 'rules-based-v1',
      inputTokens: Math.ceil((input.systemPrompt.length + input.userMessage.length) / 4),
      outputTokens: Math.ceil(content.length / 4),
      latencyMs: Date.now() - start,
    };
  }
}
