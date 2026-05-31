import { getPrisma } from '../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import { getAiRegistryAdminService } from './ai-registry-admin.service.js';

export class AiOperationsService {
  readonly name = 'AiOperationsService';

  async getOperationsDashboard() {
    const registry = getAiRegistryAdminService();
    const [providersDashboard, failoverStatus, healthDashboard, providers, models, routes] =
      await Promise.all([
        registry.getProvidersDashboard(),
        registry.getFailoverStatus(),
        registry.getHealthDashboard(),
        registry.listProviders(),
        registry.listModels(),
        registry.listRoutes(),
      ]);

    const enabledProviders = providers.filter((p) => p.enabled).length;
    const degradedProviders = providers.filter(
      (p) => p.enabled && (p.healthScore ?? 100) < 50,
    ).length;

    return {
      summary: {
        providerCount: providers.length,
        enabledProviders,
        degradedProviders,
        modelCount: models.length,
        enabledModels: models.filter((m) => m.enabled).length,
        routeCount: routes.length,
        enabledRoutes: routes.filter((r) => r.enabled).length,
        ...providersDashboard,
      },
      providers: providers.map((p) => ({
        id: p.id,
        providerKey: p.providerKey,
        displayName: p.displayName,
        enabled: p.enabled,
        healthScore: p.healthScore,
        lastHealthCheckAt: p.lastHealthCheckAt,
        modelCount: p.modelCount,
        apiKeyCount: p.apiKeyCount,
        adapterType: p.adapterType,
      })),
      models: models.map((m) => ({
        id: m.id,
        providerId: m.providerId,
        providerKey: m.providerKey,
        modelKey: m.modelKey,
        displayName: m.displayName,
        enabled: m.enabled,
        isDefault: m.isDefault,
        modelType: m.modelType,
      })),
      routes: routes.map((r) => ({
        id: r.id,
        routeKey: r.routeKey,
        name: r.name,
        taskType: r.taskType,
        enabled: r.enabled,
        priority: r.priority,
        fallbackToRules: r.fallbackToRules,
      })),
      failover: failoverStatus,
      health: healthDashboard,
    };
  }

  async getRoutePreview(taskType: string, scopeKey = PLATFORM_SCOPE_KEY) {
    const prisma = getPrisma();
    const route = await prisma.aiRoute.findFirst({
      where: { taskType, scopeKey, enabled: true, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { routeKey: 'asc' }],
    });
    if (!route) {
      return { taskType, scopeKey, resolved: false, hops: [] as Array<{ providerKey: string; modelKey?: string; order: number }> };
    }

    let chain: Array<{ providerKey?: string; modelId?: string; order?: number }> = [];
    if (route.providerChainJson && Array.isArray(route.providerChainJson)) {
      chain = route.providerChainJson as typeof chain;
    }

    const hops: Array<{ providerKey: string; modelKey?: string; order: number }> = [];
    for (const entry of chain) {
      if (!entry.providerKey) continue;
      let modelKey: string | undefined;
      if (entry.modelId) {
        const model = await prisma.aiModel.findFirst({
          where: { id: entry.modelId, deletedAt: null },
          select: { modelKey: true },
        });
        modelKey = model?.modelKey;
      }
      hops.push(
        modelKey != null
          ? { providerKey: entry.providerKey, modelKey, order: entry.order ?? hops.length }
          : { providerKey: entry.providerKey, order: entry.order ?? hops.length },
      );
    }

    return {
      taskType,
      scopeKey,
      resolved: true,
      routeKey: route.routeKey,
      routeName: route.name,
      fallbackToRules: route.fallbackToRules,
      hops,
    };
  }
}

let service: AiOperationsService | null = null;

export function getAiOperationsService(): AiOperationsService {
  if (!service) service = new AiOperationsService();
  return service;
}

export function resetAiOperationsServiceForTests(): void {
  service = null;
}
