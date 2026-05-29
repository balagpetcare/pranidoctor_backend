import { TooManyRequestsError } from '../../../shared/errors/http.errors.js';
import { checkRateLimit } from '../../../shared/security/rate-limit/rate-limit.service.js';
import { RateLimitPresets } from '../../../shared/security/rate-limit/rate-limit.config.js';
import { getAiUsageService } from '../usage/ai-usage.service.js';
import { getAiPromptService } from '../prompts/ai-prompt.service.js';

import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from './provider.interface.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { RulesBasedProvider } from './providers/rules.provider.js';

export class AiOrchestratorService {
  readonly name = 'AiOrchestratorService';

  private readonly providers: AiProviderAdapter[];
  private llmDisabled = false;

  constructor() {
    this.providers = [new OpenAiProvider(), new AnthropicProvider(), new RulesBasedProvider()];
  }

  disableLlm(): void {
    this.llmDisabled = true;
  }

  enableLlm(): void {
    this.llmDisabled = false;
  }

  isLlmDisabled(): boolean {
    return this.llmDisabled;
  }

  private resolveChain(): AiProviderAdapter[] {
    if (this.llmDisabled) {
      return [new RulesBasedProvider()];
    }

    const preferred = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
    const ordered = [...this.providers];
    ordered.sort((a, b) => {
      if (a.name === preferred) return -1;
      if (b.name === preferred) return 1;
      if (a.name === 'rules-based') return 1;
      if (b.name === 'rules-based') return -1;
      return 0;
    });
    return ordered;
  }

  private async assertDailyLlmQuota(userId?: string): Promise<void> {
    if (!userId) return;
    const result = await checkRateLimit(`user:${userId}`, RateLimitPresets.AI_CHAT_DAILY);
    if (!result.allowed) {
      throw new TooManyRequestsError(
        'AI_DAILY_LIMIT',
        'Daily AI usage limit reached. Try again tomorrow or contact support.',
        { retryAfter: result.retryAfter, resetAt: result.resetAt.toISOString() },
      );
    }
  }

  async complete(
    input: AiCompletionInput & { userId?: string; customerId?: string },
  ): Promise<AiCompletionOutput> {
    const chain = this.resolveChain();
    const usesLlm = chain.some((p) => p.name !== 'rules-based' && p.isConfigured());
    if (usesLlm) {
      await this.assertDailyLlmQuota(input.userId);
    }

    for (const provider of chain) {
      if (provider.name !== 'rules-based' && !provider.isConfigured()) {
        continue;
      }

      try {
        const result = await provider.complete(input);
        await getAiUsageService().record({
          userId: input.userId,
          customerId: input.customerId,
          feature: input.feature,
          provider: result.provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          success: true,
        });
        return result;
      } catch {
        // try next provider
      }
    }

    const fallback = new RulesBasedProvider();
    const result = await fallback.complete(input);
    await getAiUsageService().record({
      userId: input.userId,
      customerId: input.customerId,
      feature: input.feature,
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: true,
    });
    return result;
  }

  async completeWithPromptKey(params: {
    promptKey: string;
    userMessage: string;
    locale: 'bn' | 'en';
    feature: string;
    userId?: string;
    customerId?: string;
    context?: Record<string, string>;
  }): Promise<AiCompletionOutput> {
    const prompt = await getAiPromptService().resolveActive(params.promptKey);
    const systemPrompt =
      params.locale === 'bn' ? prompt.systemBn : prompt.systemEn;

    let userMessage = params.userMessage;
    if (params.context) {
      for (const [key, value] of Object.entries(params.context)) {
        userMessage = userMessage.replaceAll(`{{${key}}}`, value);
      }
    }

    return this.complete({
      feature: params.feature,
      systemPrompt,
      userMessage,
      locale: params.locale,
      userId: params.userId,
      customerId: params.customerId,
    });
  }
}

let orchestrator: AiOrchestratorService | null = null;

export function getAiOrchestratorService(): AiOrchestratorService {
  if (!orchestrator) orchestrator = new AiOrchestratorService();
  return orchestrator;
}
