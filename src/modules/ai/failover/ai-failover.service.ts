import { getPrisma } from '../../../shared/database/prisma.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { getAIRouterService } from '../routing/ai-router.service.js';
import type { RouteHop, ResolvedRoute } from '../routing/ai-router.types.js';
import { getAIProviderMonitor } from './ai-provider-monitor.js';
import { AiFailoverAbortedError, AiFailoverExhaustedError } from './failover.errors.js';
import { getFailoverRuleResolver } from './failover-rule.resolver.js';
import type {
  DbFailoverRuleRow,
  FailoverExecutionRequest,
  FailoverExecutionResult,
  FailoverHopAttempt,
  FailoverHopContext,
  FailoverHopExecutor,
  FailoverTier,
} from './failover.types.js';
import { tierForHopIndex } from './failover.types.js';
import {
  classifyExecutionError,
  retryDelayMs,
  sleep,
  withTimeout,
} from './failover.util.js';

export class AIFailoverService {
  readonly name = 'AIFailoverService';

  private readonly router = getAIRouterService();
  private readonly monitor = getAIProviderMonitor();
  private readonly ruleResolver = getFailoverRuleResolver();

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
    let hopIndex = 0;

    while (hopIndex < route.hops.length) {
      const hop = route.hops[hopIndex];
      if (!hop) break;

      const tier = tierForHopIndex(hopIndex);

      if (!hop.providerEnabled || !hop.modelEnabled) {
        attempts.push({
          tier,
          hop,
          attempt: 0,
          latencyMs: 0,
          success: false,
          errorCode: 'provider_disabled',
          skippedReason: 'disabled',
        });
        hopIndex += 1;
        continue;
      }

      if (!this.monitor.shouldAllowProvider(hop.providerKey)) {
        attempts.push({
          tier,
          hop,
          attempt: 0,
          latencyMs: 0,
          success: false,
          errorCode: 'circuit_open',
          skippedReason: 'circuit_open',
        });
        hopIndex += 1;
        continue;
      }

      let retriesRemaining = route.maxRetries;
      let attempt = 0;

      while (retriesRemaining >= 0) {
        const start = Date.now();
        attempt += 1;

        try {
          const ctx: FailoverHopContext = {
            hop,
            tier,
            timeoutMs: route.timeoutMs,
            attempt,
            route,
          };

          const result = await withTimeout(
            executor(ctx),
            route.timeoutMs,
            `${hop.providerKey}:${tier}`,
          );

          const latencyMs = Date.now() - start;
          this.monitor.recordSuccess(hop.providerKey, latencyMs);
          attempts.push({ tier, hop, attempt, latencyMs, success: true });

          logAiExecution('ai_failover_success', {
            feature: request.feature,
            taskType: request.taskType,
            provider: hop.providerKey,
            model: hop.modelKey,
            tier,
            attempt,
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
          this.monitor.recordFailure(hop.providerKey, latencyMs, errorCode);
          attempts.push({ tier, hop, attempt, latencyMs, success: false, errorCode });

          logAiExecution('ai_failover_attempt_failed', {
            feature: request.feature,
            taskType: request.taskType,
            provider: hop.providerKey,
            tier,
            attempt,
            errorCode,
          });

          const ruleInput: Parameters<typeof this.ruleResolver.resolve>[0] = {
            rules,
            errorCode,
            fromProviderId: hop.providerId,
            retriesRemaining,
          };
          if (statusCode != null) ruleInput.statusCode = statusCode;

          const decision = this.ruleResolver.resolve(ruleInput);

          if (decision === 'abort') {
            throw new AiFailoverAbortedError(request.taskType, errorCode);
          }

          if (decision === 'rules_only') {
            const rulesHop = this.findRulesHop(route);
            if (rulesHop) {
              hopIndex = route.hops.findIndex((h) => h.providerKey === rulesHop.providerKey);
              break;
            }
            hopIndex = route.hops.length;
            break;
          }

          if (decision === 'retry') {
            retriesRemaining -= 1;
            if (retriesRemaining >= 0) {
              await sleep(retryDelayMs(attempt - 1));
              continue;
            }
          }

          break;
        }
      }

      hopIndex += 1;
    }

    if (route.fallbackToRules) {
      const rulesHop = this.findRulesHop(route);
      if (rulesHop && this.monitor.shouldAllowProvider(rulesHop.providerKey)) {
        const tier: FailoverTier = 'fallback';
        const start = Date.now();
        try {
          const result = await withTimeout(
            executor({
              hop: rulesHop,
              tier,
              timeoutMs: route.timeoutMs,
              attempt: 1,
              route,
            }),
            route.timeoutMs,
            'rules-based:fallback',
          );
          const latencyMs = Date.now() - start;
          this.monitor.recordSuccess(rulesHop.providerKey, latencyMs);
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
          this.monitor.recordFailure(rulesHop.providerKey, latencyMs, errorCode);
          attempts.push({
            tier,
            hop: rulesHop,
            attempt: 1,
            latencyMs,
            success: false,
            errorCode,
          });
        }
      }
    }

    throw new AiFailoverExhaustedError(request.taskType, attempts.length);
  }

  getPrimarySecondaryTertiary(route: ResolvedRoute): {
    primary?: RouteHop;
    secondary?: RouteHop;
    tertiary?: RouteHop;
  } {
    const tiers: {
      primary?: RouteHop;
      secondary?: RouteHop;
      tertiary?: RouteHop;
    } = {};
    if (route.hops[0]) tiers.primary = route.hops[0];
    if (route.hops[1]) tiers.secondary = route.hops[1];
    if (route.hops[2]) tiers.tertiary = route.hops[2];
    return tiers;
  }

  private findRulesHop(route: ResolvedRoute): RouteHop | undefined {
    return route.hops.find((hop) => hop.providerKey === 'rules-based');
  }

  private async loadFailoverRules(routeId: string): Promise<DbFailoverRuleRow[]> {
    const rows = await getPrisma().aiFailoverRule.findMany({
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
    return rows;
  }
}

let aiFailoverService: AIFailoverService | null = null;

export function getAIFailoverService(): AIFailoverService {
  if (!aiFailoverService) aiFailoverService = new AIFailoverService();
  return aiFailoverService;
}

export function resetAIFailoverServiceForTests(): void {
  aiFailoverService = null;
}
