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
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';
import {
  assertAiLlmExecutionAllowed,
  isProviderGovernanceBlocked,
  shouldUseRulesOnlyForFeature,
} from '../governance/ai-governance.enforcement.js';
import { getAiGovernanceService } from '../governance/ai-governance.service.js';
import { getAiPromptService } from '../prompts/ai-prompt.service.js';
import { getAIRouterService } from '../routing/ai-router.service.js';
import { createOrchestratorAdapterFromKey } from '../providers/orchestrator-bridge.js';
import { ensureAiProvidersBootstrapped } from '../providers/provider-factory.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';
import { assertAiPromptAllowed, filterAiResponseOutput } from '../security/ai-prompt-security.service.js';
import { resolveTaskTypeForFeature } from '../foundation/feature-task-map.js';
import { resolveFoundationScope } from '../foundation/ai-scope.util.js';
import { getAiSettingsService } from '../settings/ai-settings.service.js';
import { getAiProviderRepository } from '../repositories/ai-platform.repository.js';
import { getAiRouterEngine } from '../router/ai-router-engine.service.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

import type { AiCompletionInput, AiCompletionOutput, AiProviderAdapter } from './provider.interface.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { RulesBasedProvider } from './providers/rules.provider.js';

type EnrichedCompletionInput = AiCompletionInput & {
  userId?: string;
  customerId?: string;
};

export class AiOrchestratorService {
  readonly name = 'AiOrchestratorService';

  /** Env/bootstrap chain — tests may replace this array. */
  legacyProviders: AiProviderAdapter[];

  constructor() {
    this.legacyProviders = [new OpenAiProvider(), new AnthropicProvider(), new RulesBasedProvider()];
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

  private resolveTaskType(input: EnrichedCompletionInput): string {
    if (input.taskType?.trim()) return input.taskType.trim();
    return resolveTaskTypeForFeature(input.feature);
  }

  private async shouldUseRegistryPath(input: EnrichedCompletionInput): Promise<boolean> {
    if (process.env.AI_REGISTRY_ORCHESTRATOR_ENABLED === 'false') return false;
    const scope = resolveFoundationScope(
      omitUndefined({
        scopeKey: input.scopeKey,
        tenantId: input.tenantId,
        branchId: input.branchId,
      }),
    );
    const snapshot = await getAiSettingsService().getSnapshot(scope);
    return snapshot.routing.honorDbRoutes !== false;
  }

  private resolveEnvFallbackChain(feature: string): AiProviderAdapter[] {
    if (shouldUseRulesOnlyForFeature(feature)) {
      return [new RulesBasedProvider()];
    }

    if (this.legacyProviders.length > 0) {
      return this.legacyProviders.filter(
        (p) => p.name === 'rules-based' || !isProviderGovernanceBlocked(p.name),
      );
    }

    ensureAiProvidersBootstrapped();
    const adapters: AiProviderAdapter[] = [];
    for (const provider of getAiProviderRegistry().listConfigured()) {
      if (provider.key === 'rules_based') continue;
      const key = provider.key.replace(/_/g, '-');
      if (isProviderGovernanceBlocked(key) || isProviderGovernanceBlocked(provider.key)) continue;
      try {
        adapters.push(createOrchestratorAdapterFromKey(provider.key));
      } catch {
        // skip unregistered adapters
      }
    }
    adapters.push(new RulesBasedProvider());
    return adapters;
  }

  private async resolveDbProviderChain(
    scopeKey: string,
    feature: string,
  ): Promise<AiProviderAdapter[]> {
    if (shouldUseRulesOnlyForFeature(feature)) {
      return [new RulesBasedProvider()];
    }

    try {
      const rows = await getAiProviderRepository().listEnabled(scopeKey);
      const adapters: AiProviderAdapter[] = [];

      for (const row of rows) {
        if (row.providerKey === 'rules-based') continue;
        const normalized = row.providerKey.replace(/-/g, '_');
        if (isProviderGovernanceBlocked(row.providerKey) || isProviderGovernanceBlocked(normalized)) {
          continue;
        }
        try {
          adapters.push(createOrchestratorAdapterFromKey(row.providerKey));
        } catch {
          // Skip unregistered adapter types.
        }
      }

      adapters.push(new RulesBasedProvider());
      return adapters.length > 0 ? adapters : this.resolveEnvFallbackChain(feature);
    } catch {
      return this.resolveEnvFallbackChain(feature);
    }
  }

  private recordAttempt(
    input: EnrichedCompletionInput,
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
      taskType?: string;
      routeId?: string;
      providerId?: string;
      modelId?: string;
      promptId?: string;
      costUsd?: number;
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
        taskType: params.taskType ?? this.resolveTaskType(input),
        routeId: params.routeId,
        providerId: params.providerId,
        modelId: params.modelId,
        promptId: params.promptId ?? input.promptId,
        requestId: input.requestId,
        correlationId: input.correlationId,
        scopeKey: input.scopeKey ?? PLATFORM_SCOPE_KEY,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
      }),
    );
  }

  private attachTrace(
    output: AiCompletionOutput,
    trace: {
      routeId?: string;
      providerId?: string;
      modelId?: string;
      isFallback?: boolean;
      costUsd?: number;
    },
  ): AiCompletionOutput {
    const enriched: AiCompletionOutput = {
      ...output,
      trace: omitUndefined({
        routeId: trace.routeId,
        providerId: trace.providerId,
        modelId: trace.modelId,
        isFallback: trace.isFallback,
      }),
    };
    if (trace.costUsd != null) {
      enriched.usage = { costUsd: trace.costUsd };
    }
    return enriched;
  }

  private async completeViaRouter(input: EnrichedCompletionInput): Promise<AiCompletionOutput | null> {
    const taskType = this.resolveTaskType(input);
    const scope = resolveFoundationScope(
      omitUndefined({
        scopeKey: input.scopeKey,
        tenantId: input.tenantId,
        branchId: input.branchId,
      }),
    );

    try {
      const result = await getAiRouterEngine().executeCompletion(
        omitUndefined({
          ...input,
          taskType,
          scopeKey: scope.scopeKey,
          tenantId: scope.tenantId,
          branchId: scope.branchId,
        }),
      );

      this.recordAttempt(input, omitUndefined({
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        success: true,
        isFallback: result.routerMeta?.isFallback ?? result.trace?.isFallback,
        fromProvider: result.routerMeta?.isFallback ? result.provider : undefined,
        taskType,
        routeId: result.trace?.routeId ?? result.routerMeta?.routeId,
        providerId: result.trace?.providerId,
        modelId: result.trace?.modelId,
        costUsd: result.usage?.costUsd,
      }));

      return this.attachTrace(result, omitUndefined({
        routeId: result.trace?.routeId ?? result.routerMeta?.routeId,
        providerId: result.trace?.providerId,
        modelId: result.trace?.modelId,
        isFallback: result.routerMeta?.isFallback ?? result.trace?.isFallback,
        costUsd: result.usage?.costUsd,
      }));
    } catch {
      return null;
    }
  }

  private async completeViaAdapterChain(
    input: EnrichedCompletionInput,
    chain: AiProviderAdapter[],
    taskType: string,
  ): Promise<AiCompletionOutput> {
    const scopeKey = input.scopeKey ?? PLATFORM_SCOPE_KEY;
    let hadLlmFailure = false;

    for (const provider of chain) {
      if (provider.name !== 'rules-based' && !provider.isConfigured()) {
        continue;
      }

      const start = Date.now();
      try {
        const result = await provider.complete(input);
        const filtered = {
          ...result,
          content: filterAiResponseOutput(result.content),
        };

        let costUsd = 0;
        try {
          costUsd = await getAiCostRateService().estimateCostUsd(
            filtered.provider,
            filtered.model,
            filtered.inputTokens,
            filtered.outputTokens,
            scopeKey,
          );
        } catch {
          costUsd = 0;
        }

        this.recordAttempt(input, omitUndefined({
          provider: filtered.provider,
          model: filtered.model,
          inputTokens: filtered.inputTokens,
          outputTokens: filtered.outputTokens,
          latencyMs: filtered.latencyMs,
          success: true,
          isFallback: hadLlmFailure && filtered.provider === 'rules-based',
          fromProvider: hadLlmFailure ? 'llm_chain' : undefined,
          taskType,
          costUsd,
        }));

        return this.attachTrace(filtered, {
          isFallback: hadLlmFailure && filtered.provider === 'rules-based',
          costUsd,
        });
      } catch (err) {
        hadLlmFailure = provider.name !== 'rules-based';
        this.recordAttempt(input, {
          provider: provider.name,
          model: resolveDefaultModel(provider.name),
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          success: false,
          errorCode: classifyProviderError(err),
          taskType,
        });
        logAiExecution('orchestrator_provider_failed', {
          feature: input.feature,
          provider: provider.name,
          errorCode: classifyProviderError(err),
        });
      }
    }

    return this.completeRulesOnly(input, true, taskType);
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

  async complete(input: EnrichedCompletionInput): Promise<AiCompletionOutput> {
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

    const safeUserMessage = assertAiPromptAllowed(input.userMessage, omitUndefined({
      feature: input.feature,
      userId: input.userId,
      customerId,
    }));

    const enrichedInput = omitUndefined({
      ...input,
      userMessage: safeUserMessage,
      customerId,
    });

    assertAiLlmExecutionAllowed(enrichedInput.feature);

    const taskType = this.resolveTaskType(enrichedInput);
    const scope = resolveFoundationScope(
      omitUndefined({
        scopeKey: enrichedInput.scopeKey,
        tenantId: enrichedInput.tenantId,
        branchId: enrichedInput.branchId,
      }),
    );

    const useRegistry = await this.shouldUseRegistryPath(enrichedInput);
    let chain: AiProviderAdapter[] = [];

    if (useRegistry) {
      const routerResult = await this.completeViaRouter(enrichedInput);
      if (routerResult) {
        traceWorkflow({
          workflow: 'ai',
          step: 'orchestrator_complete',
          outcome: 'completed',
          metadata: { feature: input.feature, provider: routerResult.provider, mode: 'router' },
        });
        logAiExecution('orchestrator_complete', {
          feature: input.feature,
          provider: routerResult.provider,
          latencyMs: routerResult.latencyMs,
        });
        return routerResult;
      }

      try {
        const resolved = await getAIRouterService().resolve(
          omitUndefined({
            taskType,
            tenantId: scope.tenantId,
            branchId: scope.branchId,
          }),
        );
        for (const hop of resolved.hops) {
          if (!hop.providerEnabled || !hop.modelEnabled) continue;
          if (isProviderGovernanceBlocked(hop.providerKey)) continue;
          try {
            chain.push(createOrchestratorAdapterFromKey(hop.providerKey));
          } catch {
            // skip
          }
        }
        if (resolved.fallbackToRules) {
          chain.push(new RulesBasedProvider());
        }
      } catch {
        chain = [];
      }
    }

    if (chain.length === 0) {
      chain = useRegistry
        ? await this.resolveDbProviderChain(scope.scopeKey, enrichedInput.feature)
        : this.resolveEnvFallbackChain(enrichedInput.feature);
    }

    const usesLlm = chain.some((p) => p.name !== 'rules-based' && p.isConfigured());
    if (usesLlm) {
      await this.assertDailyLlmQuota(enrichedInput.userId);
      await getAiBudgetService().assertBudgetAllowsLlm();
      if (getAiBudgetService().isBudgetBlocked()) {
        return this.completeRulesOnly(enrichedInput, true, taskType);
      }
    }

    const result = await this.completeViaAdapterChain(enrichedInput, chain, taskType);
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
  }

  private async completeRulesOnly(
    input: EnrichedCompletionInput,
    hadLlmFailure: boolean,
    taskType: string,
  ): Promise<AiCompletionOutput> {
    const fallback = new RulesBasedProvider();
    const result = await fallback.complete(input);
    const filtered = {
      ...result,
      content: filterAiResponseOutput(result.content),
    };
    this.recordAttempt(input, omitUndefined({
      provider: filtered.provider,
      model: filtered.model,
      inputTokens: filtered.inputTokens,
      outputTokens: filtered.outputTokens,
      latencyMs: filtered.latencyMs,
      success: true,
      isFallback: hadLlmFailure,
      fromProvider: hadLlmFailure ? 'llm_chain' : undefined,
      taskType,
    }));
    return this.attachTrace(filtered, { isFallback: hadLlmFailure });
  }

  async completeWithPromptKey(params: {
    promptKey: string;
    userMessage: string;
    locale: 'bn' | 'en';
    feature: string;
    userId?: string;
    customerId?: string;
    context?: Record<string, string>;
    taskType?: string;
    sessionId?: string;
  }): Promise<AiCompletionOutput> {
    const prompt = await getAiPromptService().resolveActive(params.promptKey);
    const systemPrompt = params.locale === 'bn' ? prompt.systemBn : prompt.systemEn;

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
        taskType: params.taskType,
        sessionId: params.sessionId,
        promptId: prompt.id,
      }),
    );
  }
}

let orchestrator: AiOrchestratorService | null = null;

export function getAiOrchestratorService(): AiOrchestratorService {
  if (!orchestrator) orchestrator = new AiOrchestratorService();
  return orchestrator;
}

export function resetAiOrchestratorServiceForTests(): void {
  orchestrator = null;
}
