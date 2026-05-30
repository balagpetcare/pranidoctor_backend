import { omitUndefined } from '../../../shared/types/object.utils.js';
import { TooManyRequestsError } from '../../../shared/errors/http.errors.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { traceWorkflow } from '../../../shared/monitoring/workflow-tracing.js';
import { checkRateLimit } from '../../../shared/security/rate-limit/rate-limit.service.js';
import { RateLimitPresets } from '../../../shared/security/rate-limit/rate-limit.config.js';
import { getAiBudgetService } from '../budget/ai-budget.service.js';
import { getAiRepository } from '../ai.repository.js';
import { getAiUsageService } from '../usage/ai-usage.service.js';
import { classifyProviderError } from '../usage/ai-usage.errors.js';
import { resolveDefaultModel } from '../usage/ai-usage.cost.js';
import {
  assertAiLlmExecutionAllowed,
  isProviderGovernanceBlocked,
  shouldUseRulesOnlyForFeature,
} from '../governance/ai-governance.enforcement.js';
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

  /** Fixed failover chain: OpenAI → Anthropic → rules-based. */
  private resolveChain(feature: string): AiProviderAdapter[] {
    if (shouldUseRulesOnlyForFeature(feature)) {
      return [new RulesBasedProvider()];
    }

    const order: Array<AiProviderAdapter['name']> = ['openai', 'anthropic', 'rules-based'];
    const ordered = order
      .map((name) => this.providers.find((p) => p.name === name))
      .filter((p): p is AiProviderAdapter => p != null);

    return ordered.filter(
      (p) => p.name === 'rules-based' || !isProviderGovernanceBlocked(p.name),
    );
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
    getAiUsageService().recordAttempt(
      omitUndefined({
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
      }),
    );
  }

  async complete(
    input: AiCompletionInput & { userId?: string; customerId?: string },
  ): Promise<AiCompletionOutput> {
    traceWorkflow({
      workflow: 'ai',
      step: 'orchestrator_start',
      outcome: 'started',
      metadata: { feature: input.feature },
    });
    logAiExecution('orchestrator_start', {
      feature: input.feature,
      locale: input.locale,
    });

    let customerId = input.customerId;
    if (!customerId && input.userId) {
      customerId = (await getAiRepository().resolveCustomerId(input.userId)) ?? undefined;
    }
    const enrichedInput = omitUndefined({ ...input, customerId });

    assertAiLlmExecutionAllowed(enrichedInput.feature);

    const chain = this.resolveChain(enrichedInput.feature);
    const usesLlm = chain.some((p) => p.name !== 'rules-based' && p.isConfigured());
    if (usesLlm) {
      await this.assertDailyLlmQuota(enrichedInput.userId);
      await getAiBudgetService().assertBudgetAllowsLlm();
      if (getAiBudgetService().isBudgetBlocked()) {
        return this.completeRulesOnly(enrichedInput, true);
      }
    }

    let hadLlmFailure = false;

    for (const provider of chain) {
      if (provider.name !== 'rules-based' && !provider.isConfigured()) {
        continue;
      }

      const start = Date.now();
      try {
        const result = await provider.complete(enrichedInput);
        this.recordAttempt(
          enrichedInput,
          omitUndefined({
            provider: result.provider,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
            success: true,
            isFallback: hadLlmFailure && result.provider === 'rules-based',
            fromProvider: hadLlmFailure ? 'llm_chain' : undefined,
          }),
        );
        traceWorkflow({
          workflow: 'ai',
          step: 'orchestrator_complete',
          outcome: 'completed',
          metadata: { feature: input.feature, provider: result.provider },
        });
        logAiExecution('orchestrator_complete', {
          feature: input.feature,
          provider: result.provider,
          latencyMs: result.latencyMs,
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
        logAiExecution('orchestrator_provider_failed', {
          feature: input.feature,
          provider: provider.name,
          errorCode: classifyProviderError(err),
        });
      }
    }

    return this.completeRulesOnly(enrichedInput, true);
  }

  private async completeRulesOnly(
    input: AiCompletionInput & { userId?: string; customerId?: string },
    hadLlmFailure: boolean,
  ): Promise<AiCompletionOutput> {
    const fallback = new RulesBasedProvider();
    const result = await fallback.complete(input);
    this.recordAttempt(input, omitUndefined({
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      success: true,
      isFallback: hadLlmFailure,
      fromProvider: hadLlmFailure ? 'llm_chain' : undefined,
    }));
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

    return this.complete(
      omitUndefined({
        feature: params.feature,
        systemPrompt,
        userMessage,
        locale: params.locale,
        userId: params.userId,
        customerId: params.customerId,
      }),
    );
  }
}

let orchestrator: AiOrchestratorService | null = null;

export function getAiOrchestratorService(): AiOrchestratorService {
  if (!orchestrator) orchestrator = new AiOrchestratorService();
  return orchestrator;
}
