import type { AiProviderInput, AiProviderOutput } from '../ai-veterinary-core.types.js';

export interface AiProviderAdapter {
  readonly name: string;
  complete(input: AiProviderInput): Promise<AiProviderOutput>;
}

export class RulesBasedAiProvider implements AiProviderAdapter {
  readonly name = 'rules-based-v1';

  async complete(input: AiProviderInput): Promise<AiProviderOutput> {
    const locale = input.locale;
    const context = input.contextSummary ? ` Context: ${input.contextSummary}.` : '';

    const content =
      locale === 'bn'
        ? `আপনার বর্ণনা অনুযায়ী, সাধারণ যত্নের পরামর্শ: বিশ্রাম, পরিষ্কার পানি ও পর্যবেক্ষণ রাখুন।${context} নিশ্চিত সিদ্ধান্তের জন্য চিকিৎসকের পরামর্শ নিন।`
        : `Based on your description, general care guidance: rest, clean water, and observation.${context} Consult a veterinarian for confirmed decisions.`;

    return { content, confidence: 0.72 };
  }
}

let provider: AiProviderAdapter | null = null;

export function getAiProvider(): AiProviderAdapter {
  if (!provider) provider = new RulesBasedAiProvider();
  return provider;
}
