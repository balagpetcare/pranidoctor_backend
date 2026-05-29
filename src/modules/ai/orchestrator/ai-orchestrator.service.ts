import { TooManyRequestsError } from '../../../shared/errors/http.errors.js';
import { checkRateLimit } from '../../../shared/security/rate-limit/rate-limit.service.js';
import { RateLimitPresets } from '../../../shared/security/rate-limit/rate-limit.config.js';
import { getAiRepository } from '../ai.repository.js';
import { getAiUsageService } from '../usage/ai-usage.service.js';
import { classifyProviderError } from '../usage/ai-usage.errors.js';
import { resolveDefaultModel } from '../usage/ai-usage.cost.js';
import { getAiGovernanceService } from '../governance/ai-governance.service.js';
import { getAiPromptService } from '../prompts/ai-prompt.service.js';

import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from './provider.interface.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { RulesBasedProvider } from './providers/rules.provider.js';

export class AiOrchestratorService {
  readonly name = 'AiOrchestratorService';

  private readonly providers: AiProviderAdapter[];

  constructor() {
    this.providers = [new OpenAiProvider(), new AnthropicProvider(), new RulesBasedProvider()];
  }

  /** @deprecated Prefer `getAiGovernanceService().setLlmDisabled()` — local-only for tests. */
  disableLlm(): void {
    getAiGovernanceService().applyLocalState(true);
  }

  /** @deprecated Prefer `getAiGovernanceService().setLlmDisabled()` — local-only for tests. */
  enableLlm(): void {
    getAiGovernanceService().applyLocalState(false);
  }

  isLlmDisabled(): boolean {
    return getAiGovernanceService().isLlmDisabled();
  }

  private resolveChain(): AiProviderAdapter[] {
    if (this.isLlmDisabled()) {
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

  private recordAttempt(
    input: AiCompletionInput & { userId?: string; customerId?: string },
    params: {
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      success: boolean;
      errorCode?: string;
      isFallback?: boolean;
      fromProvider?: string;
    },
  ): void {
    getAiUsageService().recordAttempt({
      userId: input.userId,
      customerId: input.customerId,
      feature: input.feature,
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      latencyMs: params.latencyMs,
      success: params.success,
      errorCode: params.errorCode,
      isFallback: params.isFallback,
      fromProvider: params.fromProvider,
    });
  }

  async complete(
    input: AiCompletionInput & { userId?: string; customerId?: string },
  ): Promise<AiCompletionOutput> {
    let customerId = input.customerId;
    if (!customerId && input.userId) {
      customerId = (await getAiRepository().resolveCustomerId(input.userId)) ?? undefined;
    }
    const enrichedInput = { ...input, customerId };

    const chain = this.resolveChain();
    const usesLlm = chain.some((p) => p.name !== 'rules-based' && p.isConfigured());
    if (usesLlm) {
      await this.assertDailyLlmQuota(enrichedInput.userId);
    }

    let hadLlmFailure = false;

    for (const provider of chain) {
      if (provider.name !== 'rules-based' && !provider.isConfigured()) {
        continue;
      }

      const start = Date.now();
      try {
        const result = await provider.complete(enrichedInput);
        this.recordAttempt(enrichedInput, {
          provider: result.provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          success: true,
          isFallback: hadLlmFailure && result.provider === 'rules-based',
          fromProvider: hadLlmFailure ? 'llm_chain' : undefined,
        });
        return result;
      } catch (err) {
        hadLlmFailure = provider.name !== 'rules-based';
        this.recordAttempt(enrichedInput, {
          provider: provider.name,
          model: resolveDefaultModel(provider.name),
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          success: false,
          errorCode: classifyProviderError(err),
        });
      }
    }

    const fallback = new RulesBasedProvider();
    const result = await fallback.complete(enrichedInput);
    this.recordAttempt(enrichedInput, {
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: true,
      isFallback: true,
      fromProvider: 'llm_chain',
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
