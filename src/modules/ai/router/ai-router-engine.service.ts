import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { filterAiResponseOutput } from '../security/ai-prompt-security.service.js';
import { resolveFoundationScope } from '../foundation/ai-scope.util.js';
import { resolveTaskTypeForFeature } from '../foundation/feature-task-map.js';
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';
import { getAIRouterService } from '../routing/ai-router.service.js';
import type { RouteHop, ResolvedRoute } from '../routing/ai-router.types.js';
import { AiFailoverAbortedError, AiFailoverExhaustedError } from '../failover/failover.errors.js';
import type {
  DbFailoverRuleRow,
  FailoverExecutionRequest,
  FailoverExecutionResult,
  FailoverHopAttempt,
  FailoverHopContext,
  FailoverHopExecutor,
  FailoverTier,
} from '../failover/failover.types.js';
import { tierForHopIndex } from '../failover/failover.types.js';
import { classifyExecutionError } from '../failover/failover.util.js';
import { getModelInvocationAdapter } from './adapters/model-invocation.adapter.js';
import { getFallbackEngine } from './engines/fallback.engine.js';
import { getRouterHealthMonitor } from './engines/health-monitor.service.js';
import { getRetryEngine } from './engines/retry.engine.js';
import { getCostGateEngine } from './engines/cost-gate.engine.js';
import { getTimeoutEngine, hopTimeoutLabel } from './engines/timeout.engine.js';
import type { RouterCompletionInput, RouterCompletionResult, RouterEmbeddingInput, RouterEmbeddingResult } from './ai-router-engine.types.js';
import { ensureAiProvidersBootstrapped } from '../providers/provider-factory.js';
import { getAiProviderRegistry } from '../providers/provider-registry.js';

/**
 * Phase 4 modular router — registry-first provider/model execution with
 * health gating, retries, timeouts, and failover policy.
 */
export class AiRouterEngine {
  readonly name = 'AiRouterEngine';

  private readonly router = getAIRouterService();
  private readonly health = getRouterHealthMonitor();
  private readonly timeout = getTimeoutEngine();
  private readonly retry = getRetryEngine();
  private readonly fallback = getFallbackEngine();
  private readonly modelAdapter = getModelInvocationAdapter();
  private readonly costGate = getCostGateEngine();

  async execute<T>(
    request: FailoverExecutionRequest,
    executor: FailoverHopExecutor<T>,
  ): Promise<FailoverExecutionResult<T>> {
    const route = await this.router.resolve({
      taskType: request.taskType,
      ...(request.tenantId != null ? { tenantId: request.tenantId } : {}),
      ...(request.branchId != null ? { branchId: request.branchId } : {}),
    });

    const rules = await this.loadFailoverRules(route.routeId);
    const attempts: FailoverHopAttempt[] = [];
    const routeStartedAt = Date.now();
    let hopIndex = 0;

    while (hopIndex < route.hops.length) {
      const hop = route.hops[hopIndex];
      if (!hop) break;

      const tier = tierForHopIndex(hopIndex);
      const skip = await this.evaluateHopSkip(hop, tier, attempts, route, request);
      if (skip) {
        hopIndex += 1;
        continue;
      }

      const hopTimeoutMs = this.timeout.hopTimeoutMs(route.timeoutMs, Date.now() - routeStartedAt);
      let retriesRemaining = route.maxRetries;
      let attempt = 0;

      while (retriesRemaining >= 0) {
        attempt += 1;
        const start = Date.now();

        try {
          const ctx: FailoverHopContext = {
            hop,
            tier,
            timeoutMs: hopTimeoutMs,
            attempt,
            route,
          };

          const result = await this.timeout.run(
            executor(ctx),
            hopTimeoutMs,
            hopTimeoutLabel(hop, tier),
          );

          const latencyMs = Date.now() - start;
          this.health.recordSuccess(hop.providerKey, latencyMs);
          attempts.push({ tier, hop, attempt, latencyMs, success: true });

          logAiExecution('ai_router_success', {
            feature: request.feature,
            taskType: request.taskType,
            provider: hop.providerKey,
            model: hop.modelKey,
            tier,
            attempt,
            hopIndex,
          });

          return {
            result,
            route,
            usedHop: hop,
            tier,
            attempts,
            isFallback: hopIndex > 0,
          };
        } catch (err) {
          const latencyMs = Date.now() - start;
          const { errorCode, statusCode } = classifyExecutionError(err);
          this.health.recordFailure(hop.providerKey, latencyMs, errorCode);
          attempts.push({ tier, hop, attempt, latencyMs, success: false, errorCode });

          logAiExecution('ai_router_attempt_failed', {
            feature: request.feature,
            taskType: request.taskType,
            provider: hop.providerKey,
            model: hop.modelKey,
            tier,
            attempt,
            errorCode,
            hopIndex,
          });

          const decision = this.fallback.decide(
            omitUndefined({
              rules,
              errorCode,
              fromProviderId: hop.providerId,
              retriesRemaining,
              statusCode,
            }),
          );

          if (decision === 'abort') {
            throw new AiFailoverAbortedError(request.taskType, errorCode);
          }

          if (decision === 'rules_only') {
            const rulesResult = await this.tryRulesFallback(
              request,
              route,
              executor,
              attempts,
              routeStartedAt,
            );
            if (rulesResult) return rulesResult;
            throw new AiFailoverExhaustedError(request.taskType, attempts.length);
          }

          if (decision === 'retry' && this.retry.canRetrySameHop(errorCode, retriesRemaining)) {
            retriesRemaining -= 1;
            const retryAfterMs = this.extractRetryAfterMs(err);
            await this.retry.wait(attempt - 1, retryAfterMs);
            continue;
          }

          break;
        }
      }

      hopIndex += 1;
    }

    const rulesResult = await this.tryRulesFallback(request, route, executor, attempts, routeStartedAt);
    if (rulesResult) return rulesResult;

    throw new AiFailoverExhaustedError(request.taskType, attempts.length);
  }

  /** High-level completion API for orchestrator — registry model resolution built-in. */
  async executeCompletion(input: RouterCompletionInput): Promise<RouterCompletionResult> {
    const taskType = input.taskType?.trim() || resolveTaskTypeForFeature(input.feature);
    const scope = resolveFoundationScope(
      omitUndefined({
        scopeKey: input.scopeKey,
        tenantId: input.tenantId,
        branchId: input.branchId,
      }),
    );

    const reservedOutput = input.maxTokens ?? 800;
    const estimatedInputTokens = this.costGate.estimateInputTokensFromText(
      input.systemPrompt,
      input.userMessage,
    );

    const exec = await this.execute(
      omitUndefined({
        taskType,
        feature: input.feature,
        tenantId: scope.tenantId ?? null,
        branchId: scope.branchId ?? null,
        scopeKey: scope.scopeKey,
        estimatedInputTokens,
        reservedOutputTokens: reservedOutput,
      }),
      async (ctx) => this.modelAdapter.complete(input, ctx.hop),
    );

    const filtered = {
      ...exec.result,
      content: filterAiResponseOutput(exec.result.content),
    };

    let costUsd = 0;
    try {
      costUsd = await getAiCostRateService().estimateCostUsd(
        filtered.provider,
        filtered.model,
        filtered.inputTokens,
        filtered.outputTokens,
        scope.scopeKey,
      );
    } catch {
      costUsd = 0;
    }

    const hopIndex = exec.route.hops.findIndex((h) => h.providerId === exec.usedHop.providerId);

    return {
      ...filtered,
      trace: omitUndefined({
        routeId: exec.route.routeId,
        providerId: exec.usedHop.providerId,
        modelId: exec.usedHop.modelId,
        isFallback: exec.isFallback,
      }),
      usage: { costUsd },
      routerMeta: {
        routeId: exec.route.routeId,
        hopIndex: hopIndex >= 0 ? hopIndex : 0,
        isFallback: exec.isFallback,
        attemptCount: exec.attempts.length,
      },
    };
  }

  /** Registry-routed embedding for RAG indexing and query vectors. */
  async executeEmbedding(input: RouterEmbeddingInput): Promise<RouterEmbeddingResult> {
    const taskType = input.taskType?.trim() || 'DOCUMENT_ANALYSIS';
    const scope = resolveFoundationScope(
      omitUndefined({
        scopeKey: input.scopeKey,
        tenantId: input.tenantId,
        branchId: input.branchId,
      }),
    );

    const exec = await this.execute(
      omitUndefined({
        taskType,
        feature: input.feature,
        tenantId: scope.tenantId ?? null,
        branchId: scope.branchId ?? null,
        scopeKey: scope.scopeKey,
      }),
      async (ctx) => {
        ensureAiProvidersBootstrapped();
        const registryKey = ctx.hop.providerKey.replace(/-/g, '_');
        const provider = getAiProviderRegistry().getOrThrow(registryKey);
        const embedInput: Parameters<typeof provider.embed>[0] = {
          feature: input.feature,
          texts: input.texts,
          model: ctx.hop.modelKey,
        };
        return provider.embed(embedInput);
      },
    );

    const hopIndex = exec.route.hops.findIndex((h) => h.providerId === exec.usedHop.providerId);

    return {
      ...exec.result,
      routerMeta: {
        routeId: exec.route.routeId,
        hopIndex: hopIndex >= 0 ? hopIndex : 0,
        isFallback: exec.isFallback,
        attemptCount: exec.attempts.length,
      },
    };
  }

  private async evaluateHopSkip(
    hop: RouteHop,
    tier: FailoverTier,
    attempts: FailoverHopAttempt[],
    route: ResolvedRoute,
    request: FailoverExecutionRequest,
  ): Promise<FailoverHopAttempt | null> {
    if (!hop.providerEnabled || !hop.modelEnabled) {
      const entry: FailoverHopAttempt = {
        tier,
        hop,
        attempt: 0,
        latencyMs: 0,
        success: false,
        errorCode: 'provider_disabled',
        skippedReason: 'disabled',
      };
      attempts.push(entry);
      return entry;
    }

    const healthSkip = this.health.skipReason(hop.providerKey);
    if (healthSkip) {
      const entry: FailoverHopAttempt = {
        tier,
        hop,
        attempt: 0,
        latencyMs: 0,
        success: false,
        errorCode: 'circuit_open',
        skippedReason: healthSkip,
      };
      attempts.push(entry);
      return entry;
    }

    if (
      request.estimatedInputTokens != null &&
      request.scopeKey &&
      route.maxCostUsd != null &&
      hop.providerKey !== 'rules-based'
    ) {
      const budget = await this.costGate.isWithinRouteBudget(route, hop, {
        scopeKey: request.scopeKey,
        estimatedInputTokens: request.estimatedInputTokens,
        reservedOutputTokens: request.reservedOutputTokens ?? 800,
      });
      if (!budget.allowed) {
        const entry: FailoverHopAttempt = {
          tier,
          hop,
          attempt: 0,
          latencyMs: 0,
          success: false,
          errorCode: 'budget_exceeded',
          skippedReason: 'budget_exceeded',
        };
        attempts.push(entry);
        return entry;
      }
    }

    return null;
  }

  private extractRetryAfterMs(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'retryAfter' in err) {
      const value = (err as { retryAfter?: unknown }).retryAfter;
      if (typeof value === 'number' && value > 0) {
        return value * 1_000;
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/retry[- ]after[:\s]+(\d+)/i);
    if (match?.[1]) {
      return Number.parseInt(match[1], 10) * 1_000;
    }
    return undefined;
  }

  private resolveRulesHop(route: ResolvedRoute): RouteHop | undefined {
    const inChain = route.hops.find((h) => h.providerKey === 'rules-based');
    if (inChain) return inChain;
    if (!route.fallbackToRules) return undefined;

    return {
      order: route.hops.length,
      providerId: 'rules-based',
      providerKey: 'rules-based',
      modelId: 'rules-based-v1',
      modelKey: 'rules-based-v1',
      modelType: 'rules',
      adapterType: 'rules',
      providerEnabled: true,
      modelEnabled: true,
    };
  }

  private async tryRulesFallback<T>(
    _request: FailoverExecutionRequest,
    route: ResolvedRoute,
    executor: FailoverHopExecutor<T>,
    attempts: FailoverHopAttempt[],
    routeStartedAt: number,
  ): Promise<FailoverExecutionResult<T> | null> {
    const rulesHop = this.resolveRulesHop(route);
    if (!rulesHop || !this.health.shouldAllowProvider(rulesHop.providerKey)) {
      return null;
    }

    const tier: FailoverTier = 'fallback';
    const hopTimeoutMs = this.timeout.hopTimeoutMs(route.timeoutMs, Date.now() - routeStartedAt);
    const start = Date.now();

    try {
      const result = await this.timeout.run(
        executor({
          hop: rulesHop,
          tier,
          timeoutMs: hopTimeoutMs,
          attempt: 1,
          route,
        }),
        hopTimeoutMs,
        'rules-based:fallback',
      );

      const latencyMs = Date.now() - start;
      this.health.recordSuccess(rulesHop.providerKey, latencyMs);
      attempts.push({ tier, hop: rulesHop, attempt: 1, latencyMs, success: true });

      return {
        result,
        route,
        usedHop: rulesHop,
        tier,
        attempts,
        isFallback: true,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const { errorCode } = classifyExecutionError(err);
      this.health.recordFailure(rulesHop.providerKey, latencyMs, errorCode);
      attempts.push({
        tier,
        hop: rulesHop,
        attempt: 1,
        latencyMs,
        success: false,
        errorCode,
      });
      return null;
    }
  }

  private async loadFailoverRules(routeId: string): Promise<DbFailoverRuleRow[]> {
    return getPrisma().aiFailoverRule.findMany({
      where: { routeId, enabled: true, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        routeId: true,
        triggerType: true,
        action: true,
        priority: true,
        fromProviderId: true,
        toProviderId: true,
        enabled: true,
      },
    });
  }
}

let aiRouterEngine: AiRouterEngine | null = null;

export function getAiRouterEngine(): AiRouterEngine {
  if (!aiRouterEngine) aiRouterEngine = new AiRouterEngine();
  return aiRouterEngine;
}

export function resetAiRouterEngineForTests(): void {
  aiRouterEngine = null;
}
