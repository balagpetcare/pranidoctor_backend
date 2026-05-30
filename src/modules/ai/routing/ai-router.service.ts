import { getPrisma } from '../../../shared/database/prisma.js';
import { logAiExecution } from '../../../shared/monitoring/structured-logging.js';
import { modalityForTask, normalizeAiTaskType, type AiDbTaskType } from './ai-task.types.js';
import type { AiRouteRequest, ResolvedRoute, RouteHop } from './ai-router.types.js';
import { getModelSelector } from './model-selector.js';
import { getRouteResolver } from './route-resolver.js';

export class AIRouterService {
  readonly name = 'AIRouterService';

  private readonly routeResolver = getRouteResolver();
  private readonly modelSelector = getModelSelector();

  /** Resolve full provider/model chain for a task from database routes. */
  async resolve(request: AiRouteRequest): Promise<ResolvedRoute> {
    const dbTaskType = normalizeAiTaskType(request.taskType);
    const { row, scopeKey } = await this.routeResolver.findRouteRow(request);
    const chain = this.routeResolver.parseChain(row);
    const modelTypeHint = this.modelTypeHintForTask(dbTaskType);

    const hops: RouteHop[] = [];
    for (const entry of chain) {
      const provider = await getPrisma().aiProvider.findFirst({
        where: { id: entry.providerId, deletedAt: null },
      });
      if (!provider) continue;

      const selectionInput: Parameters<typeof this.modelSelector.select>[0] = {
        scopeKey,
        providerId: entry.providerId,
        providerKey: entry.providerKey,
        routePrimaryModelId: row.primaryModelId,
        chainModelId: entry.modelId,
      };
      if (modelTypeHint) selectionInput.modelTypeHint = modelTypeHint;

      const selected = await this.modelSelector.select(selectionInput);

      hops.push({
        order: entry.order,
        providerId: provider.id,
        providerKey: provider.providerKey,
        modelId: selected.modelId,
        modelKey: selected.modelKey,
        modelType: selected.modelType,
        adapterType: provider.adapterType,
        providerEnabled: provider.enabled,
        modelEnabled: selected.enabled,
      });
    }

    if (hops.length === 0) {
      throw new Error(`Route "${row.routeKey}" has no resolvable provider chain`);
    }

    const resolved: ResolvedRoute = {
      routeId: row.id,
      routeKey: row.routeKey,
      taskType: row.taskType,
      scopeKey,
      name: row.name,
      maxRetries: row.maxRetries,
      timeoutMs: row.timeoutMs,
      asyncRequired: row.asyncRequired,
      maxCostUsd: row.maxCostUsd ? Number(row.maxCostUsd) : null,
      fallbackToRules: row.fallbackToRules,
      hops,
    };

    logAiExecution('ai_route_resolved', {
      routeKey: resolved.routeKey,
      taskType: resolved.taskType,
      scopeKey: resolved.scopeKey,
      hopCount: resolved.hops.length,
      primaryProvider: resolved.hops[0]?.providerKey,
      primaryModel: resolved.hops[0]?.modelKey,
    });

    return resolved;
  }

  /** First configured hop — primary route target. */
  async resolvePrimary(request: AiRouteRequest): Promise<RouteHop> {
    const route = await this.resolve(request);
    const primary = route.hops[0];
    if (!primary) {
      throw new Error(`Route "${route.routeKey}" has no primary hop`);
    }
    return primary;
  }

  modalityFor(request: AiRouteRequest): AiDbTaskType {
    return normalizeAiTaskType(request.taskType);
  }

  executionModalityFor(request: AiRouteRequest): 'chat' | 'vision' | 'embeddings' {
    return modalityForTask(normalizeAiTaskType(request.taskType));
  }

  private modelTypeHintForTask(taskType: AiDbTaskType): string | undefined {
    const modality = modalityForTask(taskType);
    if (modality === 'vision') return 'chat';
    return modality === 'embeddings' ? 'embedding' : 'chat';
  }
}

let aiRouterService: AIRouterService | null = null;

export function getAIRouterService(): AIRouterService {
  if (!aiRouterService) aiRouterService = new AIRouterService();
  return aiRouterService;
}

export function resetAIRouterServiceForTests(): void {
  aiRouterService = null;
}
