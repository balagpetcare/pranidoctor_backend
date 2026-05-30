import type { AiProvider } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiPlatformAdminService } from '../platform/ai-platform-admin.service.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import type { z } from 'zod';
import type {
  createProviderSchema,
  updateProviderSchema,
  createModelSchema,
  updateModelSchema,
  createRouteSchema,
  updateRouteSchema,
  createFailoverRuleSchema,
  updateFailoverRuleSchema,
} from './ai-admin.schemas.js';

type CreateProviderInput = z.infer<typeof createProviderSchema>;
type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
type CreateModelInput = z.infer<typeof createModelSchema>;
type UpdateModelInput = z.infer<typeof updateModelSchema>;
type CreateRouteInput = z.infer<typeof createRouteSchema>;
type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
type CreateFailoverInput = z.infer<typeof createFailoverRuleSchema>;
type UpdateFailoverInput = z.infer<typeof updateFailoverRuleSchema>;

function resolveScopeKey(input?: { scopeKey?: string; tenantId?: string; branchId?: string }): string {
  if (input?.scopeKey?.trim()) return input.scopeKey.trim();
  if (input?.tenantId && input?.branchId) return `tenant:${input.tenantId}:branch:${input.branchId}`;
  if (input?.tenantId) return `tenant:${input.tenantId}`;
  return PLATFORM_SCOPE_KEY;
}

function toProviderView(row: AiProvider & { _count?: { models: number; apiKeys: number } }) {
  return {
    id: row.id,
    scopeKey: row.scopeKey,
    providerKey: row.providerKey,
    displayName: row.displayName,
    description: row.description,
    enabled: row.enabled,
    priority: row.priority,
    adapterType: row.adapterType,
    baseUrl: row.baseUrl,
    costTier: row.costTier,
    healthScore: row.healthScore,
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    capabilitiesJson: row.capabilitiesJson,
    configJson: row.configJson,
    modelCount: row._count?.models ?? 0,
    apiKeyCount: row._count?.apiKeys ?? 0,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AiRegistryAdminService {
  readonly name = 'AiRegistryAdminService';

  async listProviders(scopeKey?: string) {
    const prisma = getPrisma();
    const scope = scopeKey ?? PLATFORM_SCOPE_KEY;
    const rows = await prisma.aiProvider.findMany({
      where: { scopeKey: scope, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { providerKey: 'asc' }],
      include: { _count: { select: { models: true, apiKeys: true } } },
    });
    return rows.map(toProviderView);
  }

  async getProvider(id: string) {
    const prisma = getPrisma();
    const row = await prisma.aiProvider.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { models: true, apiKeys: true } } },
    });
    if (!row) throw new Error('Provider not found');
    return toProviderView(row);
  }

  async createProvider(input: CreateProviderInput, actorUserId?: string) {
    const prisma = getPrisma();
    const scopeKey = resolveScopeKey(input);
    const existing = await prisma.aiProvider.findFirst({
      where: { scopeKey, providerKey: input.providerKey, deletedAt: null },
    });
    if (existing) throw new Error(`Provider key "${input.providerKey}" already exists`);

    const row = await prisma.aiProvider.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        providerKey: input.providerKey,
        displayName: input.displayName,
        description: input.description ?? null,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 100,
        adapterType: input.adapterType ?? 'openai_compatible',
        baseUrl: input.baseUrl ?? null,
        costTier: input.costTier ?? 'standard',
        capabilitiesJson: input.capabilitiesJson ?? [],
        configJson: input.configJson ?? undefined,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
      include: { _count: { select: { models: true, apiKeys: true } } },
    });
    return toProviderView(row);
  }

  async updateProvider(id: string, input: UpdateProviderInput, actorUserId?: string) {
    const prisma = getPrisma();
    await this.getProvider(id);
    const row = await prisma.aiProvider.update({
      where: { id },
      data: {
        ...(input.displayName != null ? { displayName: input.displayName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.priority != null ? { priority: input.priority } : {}),
        ...(input.adapterType != null ? { adapterType: input.adapterType } : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.costTier != null ? { costTier: input.costTier } : {}),
        ...(input.capabilitiesJson != null ? { capabilitiesJson: input.capabilitiesJson } : {}),
        ...(input.configJson !== undefined ? { configJson: input.configJson ?? undefined } : {}),
        updatedByUserId: actorUserId ?? null,
      },
      include: { _count: { select: { models: true, apiKeys: true } } },
    });
    return toProviderView(row);
  }

  async toggleProvider(id: string, enabled: boolean, actorUserId?: string) {
    return this.updateProvider(id, { enabled }, actorUserId);
  }

  async getProvidersDashboard() {
    return getAiPlatformAdminService().getProvidersDashboard();
  }

  async listModels(scopeKey?: string, providerId?: string) {
    const prisma = getPrisma();
    const scope = scopeKey ?? PLATFORM_SCOPE_KEY;
    const rows = await prisma.aiModel.findMany({
      where: {
        scopeKey: scope,
        deletedAt: null,
        ...(providerId ? { providerId } : {}),
      },
      orderBy: [{ providerId: 'asc' }, { modelKey: 'asc' }],
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      scopeKey: row.scopeKey,
      providerId: row.providerId,
      providerKey: row.provider.providerKey,
      providerName: row.provider.displayName,
      modelKey: row.modelKey,
      displayName: row.displayName,
      modelType: row.modelType,
      contextWindow: row.contextWindow,
      maxOutputTokens: row.maxOutputTokens,
      inputCostPerToken: Number(row.inputCostPerToken),
      outputCostPerToken: Number(row.outputCostPerToken),
      enabled: row.enabled,
      isDefault: row.isDefault,
      capabilitiesJson: row.capabilitiesJson,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createModel(input: CreateModelInput, actorUserId?: string) {
    const prisma = getPrisma();
    const scopeKey = resolveScopeKey(input);
    const provider = await prisma.aiProvider.findFirst({
      where: { id: input.providerId, deletedAt: null },
    });
    if (!provider) throw new Error('Provider not found');

    const existing = await prisma.aiModel.findFirst({
      where: { scopeKey, providerId: input.providerId, modelKey: input.modelKey, deletedAt: null },
    });
    if (existing) throw new Error(`Model "${input.modelKey}" already exists for provider`);

    const row = await prisma.aiModel.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        providerId: input.providerId,
        modelKey: input.modelKey,
        displayName: input.displayName,
        modelType: input.modelType ?? 'chat',
        contextWindow: input.contextWindow ?? null,
        maxOutputTokens: input.maxOutputTokens ?? null,
        inputCostPerToken: input.inputCostPerToken ?? 0,
        outputCostPerToken: input.outputCostPerToken ?? 0,
        enabled: input.enabled ?? true,
        isDefault: input.isDefault ?? false,
        capabilitiesJson: input.capabilitiesJson ?? [],
        metadataJson: input.metadataJson ?? undefined,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    return {
      id: row.id,
      providerKey: row.provider.providerKey,
      modelKey: row.modelKey,
      displayName: row.displayName,
      enabled: row.enabled,
    };
  }

  async updateModel(id: string, input: UpdateModelInput, actorUserId?: string) {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Model not found');

    await prisma.aiModel.update({
      where: { id },
      data: {
        ...(input.displayName != null ? { displayName: input.displayName } : {}),
        ...(input.modelType != null ? { modelType: input.modelType } : {}),
        ...(input.contextWindow !== undefined ? { contextWindow: input.contextWindow } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
        ...(input.inputCostPerToken != null ? { inputCostPerToken: input.inputCostPerToken } : {}),
        ...(input.outputCostPerToken != null ? { outputCostPerToken: input.outputCostPerToken } : {}),
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.isDefault != null ? { isDefault: input.isDefault } : {}),
        ...(input.capabilitiesJson != null ? { capabilitiesJson: input.capabilitiesJson } : {}),
        ...(input.metadataJson !== undefined ? { metadataJson: input.metadataJson ?? undefined } : {}),
        updatedByUserId: actorUserId ?? null,
      },
    });
    return this.listModels(existing.scopeKey).then((rows) => rows.find((r) => r.id === id)!);
  }

  async toggleModel(id: string, enabled: boolean, actorUserId?: string) {
    return this.updateModel(id, { enabled }, actorUserId);
  }

  async listRoutes(scopeKey?: string) {
    const prisma = getPrisma();
    const scope = scopeKey ?? PLATFORM_SCOPE_KEY;
    const rows = await prisma.aiRoute.findMany({
      where: { scopeKey: scope, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { taskType: 'asc' }],
      include: {
        primaryProvider: { select: { providerKey: true, displayName: true } },
        primaryModel: { select: { modelKey: true, displayName: true } },
        _count: { select: { failoverRules: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      routeKey: row.routeKey,
      name: row.name,
      taskType: row.taskType,
      description: row.description,
      enabled: row.enabled,
      priority: row.priority,
      primaryProviderId: row.primaryProviderId,
      primaryProviderKey: row.primaryProvider?.providerKey ?? null,
      primaryModelId: row.primaryModelId,
      primaryModelKey: row.primaryModel?.modelKey ?? null,
      providerChainJson: row.providerChainJson,
      maxRetries: row.maxRetries,
      timeoutMs: row.timeoutMs,
      asyncRequired: row.asyncRequired,
      maxCostUsd: row.maxCostUsd != null ? Number(row.maxCostUsd) : null,
      fallbackToRules: row.fallbackToRules,
      failoverRuleCount: row._count.failoverRules,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createRoute(input: CreateRouteInput, actorUserId?: string) {
    const prisma = getPrisma();
    const scopeKey = resolveScopeKey(input);
    const existing = await prisma.aiRoute.findFirst({
      where: { scopeKey, routeKey: input.routeKey, deletedAt: null },
    });
    if (existing) throw new Error(`Route key "${input.routeKey}" already exists`);

    const row = await prisma.aiRoute.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        routeKey: input.routeKey,
        name: input.name,
        taskType: input.taskType,
        description: input.description ?? null,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 100,
        primaryProviderId: input.primaryProviderId ?? null,
        primaryModelId: input.primaryModelId ?? null,
        providerChainJson: input.providerChainJson ?? [],
        maxRetries: input.maxRetries ?? 2,
        timeoutMs: input.timeoutMs ?? 30_000,
        asyncRequired: input.asyncRequired ?? false,
        maxCostUsd: input.maxCostUsd ?? null,
        fallbackToRules: input.fallbackToRules ?? true,
        conditionsJson: input.conditionsJson ?? undefined,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
    return { id: row.id, routeKey: row.routeKey, name: row.name, taskType: row.taskType };
  }

  async updateRoute(id: string, input: UpdateRouteInput, actorUserId?: string) {
    const prisma = getPrisma();
    const existing = await prisma.aiRoute.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Route not found');

    await prisma.aiRoute.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.taskType != null ? { taskType: input.taskType } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.priority != null ? { priority: input.priority } : {}),
        ...(input.primaryProviderId !== undefined ? { primaryProviderId: input.primaryProviderId } : {}),
        ...(input.primaryModelId !== undefined ? { primaryModelId: input.primaryModelId } : {}),
        ...(input.providerChainJson != null ? { providerChainJson: input.providerChainJson } : {}),
        ...(input.maxRetries != null ? { maxRetries: input.maxRetries } : {}),
        ...(input.timeoutMs != null ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.asyncRequired != null ? { asyncRequired: input.asyncRequired } : {}),
        ...(input.maxCostUsd !== undefined ? { maxCostUsd: input.maxCostUsd } : {}),
        ...(input.fallbackToRules != null ? { fallbackToRules: input.fallbackToRules } : {}),
        ...(input.conditionsJson !== undefined ? { conditionsJson: input.conditionsJson ?? undefined } : {}),
        updatedByUserId: actorUserId ?? null,
      },
    });
    return this.listRoutes(existing.scopeKey).then((rows) => rows.find((r) => r.id === id)!);
  }

  async toggleRoute(id: string, enabled: boolean, actorUserId?: string) {
    return this.updateRoute(id, { enabled }, actorUserId);
  }

  async listFailoverRules(scopeKey?: string, routeId?: string) {
    const prisma = getPrisma();
    const scope = scopeKey ?? PLATFORM_SCOPE_KEY;
    const rows = await prisma.aiFailoverRule.findMany({
      where: {
        scopeKey: scope,
        deletedAt: null,
        ...(routeId ? { routeId } : {}),
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        route: { select: { routeKey: true, name: true } },
        fromProvider: { select: { providerKey: true } },
        toProvider: { select: { providerKey: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      routeId: row.routeId,
      routeKey: row.route?.routeKey ?? null,
      routeName: row.route?.name ?? null,
      enabled: row.enabled,
      priority: row.priority,
      triggerType: row.triggerType,
      action: row.action,
      fromProviderId: row.fromProviderId,
      fromProviderKey: row.fromProvider?.providerKey ?? null,
      toProviderId: row.toProviderId,
      toProviderKey: row.toProvider?.providerKey ?? null,
      fromModelId: row.fromModelId,
      toModelId: row.toModelId,
      triggerConfigJson: row.triggerConfigJson,
      actionConfigJson: row.actionConfigJson,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createFailoverRule(input: CreateFailoverInput, actorUserId?: string) {
    const prisma = getPrisma();
    const scopeKey = resolveScopeKey(input);
    const row = await prisma.aiFailoverRule.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        routeId: input.routeId ?? null,
        name: input.name,
        enabled: input.enabled ?? true,
        priority: input.priority ?? 100,
        triggerType: input.triggerType,
        triggerConfigJson: input.triggerConfigJson ?? undefined,
        fromProviderId: input.fromProviderId ?? null,
        toProviderId: input.toProviderId ?? null,
        fromModelId: input.fromModelId ?? null,
        toModelId: input.toModelId ?? null,
        action: input.action,
        actionConfigJson: input.actionConfigJson ?? undefined,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
    return { id: row.id, name: row.name, triggerType: row.triggerType, action: row.action };
  }

  async updateFailoverRule(id: string, input: UpdateFailoverInput, actorUserId?: string) {
    const prisma = getPrisma();
    const existing = await prisma.aiFailoverRule.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Failover rule not found');

    await prisma.aiFailoverRule.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
        ...(input.enabled != null ? { enabled: input.enabled } : {}),
        ...(input.priority != null ? { priority: input.priority } : {}),
        ...(input.triggerType != null ? { triggerType: input.triggerType } : {}),
        ...(input.triggerConfigJson !== undefined
          ? { triggerConfigJson: input.triggerConfigJson ?? undefined }
          : {}),
        ...(input.fromProviderId !== undefined ? { fromProviderId: input.fromProviderId } : {}),
        ...(input.toProviderId !== undefined ? { toProviderId: input.toProviderId } : {}),
        ...(input.fromModelId !== undefined ? { fromModelId: input.fromModelId } : {}),
        ...(input.toModelId !== undefined ? { toModelId: input.toModelId } : {}),
        ...(input.action != null ? { action: input.action } : {}),
        ...(input.actionConfigJson !== undefined
          ? { actionConfigJson: input.actionConfigJson ?? undefined }
          : {}),
        updatedByUserId: actorUserId ?? null,
      },
    });
    return this.listFailoverRules(existing.scopeKey).then((rows) => rows.find((r) => r.id === id)!);
  }

  async toggleFailoverRule(id: string, enabled: boolean, actorUserId?: string) {
    return this.updateFailoverRule(id, { enabled }, actorUserId);
  }

  async getFailoverStatus() {
    const { getAIProviderMonitor } = await import('../failover/ai-provider-monitor.js');
    const monitor = getAIProviderMonitor();
    const rules = await this.listFailoverRules();
    return {
      circuitBreakers: monitor.getAllSnapshots(),
      rules,
      ruleCount: rules.length,
      activeRules: rules.filter((r) => r.enabled).length,
    };
  }

  async getHealthDashboard() {
    return getAiPlatformAdminService().getHealthDashboard();
  }
}

let aiRegistryAdminService: AiRegistryAdminService | null = null;

export function getAiRegistryAdminService(): AiRegistryAdminService {
  if (!aiRegistryAdminService) aiRegistryAdminService = new AiRegistryAdminService();
  return aiRegistryAdminService;
}

export function resetAiRegistryAdminServiceForTests(): void {
  aiRegistryAdminService = null;
}
