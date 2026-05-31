import type { AiProvider, Prisma } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson, toNullableInputJson } from '../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getAiPlatformAdminService } from '../platform/ai-platform-admin.service.js';
import { getAiModelRegistryService } from '../models/ai-model-registry.service.js';
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

function resolveScopeKey(input: {
  scopeKey?: string | undefined;
  tenantId?: string | undefined;
  branchId?: string | undefined;
} = {}): string {
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
        enabled: input.enabled ?? false,
        priority: input.priority ?? 100,
        adapterType: input.adapterType ?? 'openai_compatible',
        baseUrl: input.baseUrl ?? null,
        costTier: input.costTier ?? 'standard',
        capabilitiesJson: input.capabilitiesJson ?? [],
        ...(input.configJson != null ? { configJson: toInputJson(input.configJson) } : {}),
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
    const data: Prisma.AiProviderUncheckedUpdateInput = {
      updatedByUserId: actorUserId ?? null,
    };
    if (input.displayName != null) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.enabled != null) data.enabled = input.enabled;
    if (input.priority != null) data.priority = input.priority;
    if (input.adapterType != null) data.adapterType = input.adapterType;
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.costTier != null) data.costTier = input.costTier;
    if (input.capabilitiesJson != null) data.capabilitiesJson = input.capabilitiesJson;
    if (input.configJson !== undefined) {
      data.configJson = toNullableInputJson(input.configJson);
    }

    const row = await prisma.aiProvider.update({
      where: { id },
      data,
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
    return getAiModelRegistryService().listModels(
      omitUndefined({
        scopeKey,
        providerId,
      }),
    );
  }

  async createModel(input: CreateModelInput, actorUserId?: string) {
    return getAiModelRegistryService().createModel(input, actorUserId);
  }

  async updateModel(id: string, input: UpdateModelInput, actorUserId?: string) {
    return getAiModelRegistryService().updateModel(id, input, actorUserId);
  }

  async toggleModel(id: string, enabled: boolean, actorUserId?: string) {
    if (!actorUserId) {
      throw new Error('Actor required for model toggle');
    }
    return getAiModelRegistryService().toggleModel(id, enabled, {
      id: actorUserId,
      role: 'admin',
    });
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
        providerChainJson: toInputJson(input.providerChainJson ?? []),
        maxRetries: input.maxRetries ?? 2,
        timeoutMs: input.timeoutMs ?? 30_000,
        asyncRequired: input.asyncRequired ?? false,
        maxCostUsd: input.maxCostUsd ?? null,
        fallbackToRules: input.fallbackToRules ?? true,
        ...(input.conditionsJson != null ? { conditionsJson: toInputJson(input.conditionsJson) } : {}),
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

    const data: Prisma.AiRouteUncheckedUpdateInput = {
      updatedByUserId: actorUserId ?? null,
    };
    if (input.name != null) data.name = input.name;
    if (input.taskType != null) data.taskType = input.taskType;
    if (input.description !== undefined) data.description = input.description;
    if (input.enabled != null) data.enabled = input.enabled;
    if (input.priority != null) data.priority = input.priority;
    if (input.primaryProviderId !== undefined) data.primaryProviderId = input.primaryProviderId;
    if (input.primaryModelId !== undefined) data.primaryModelId = input.primaryModelId;
    if (input.providerChainJson != null) data.providerChainJson = toInputJson(input.providerChainJson);
    if (input.maxRetries != null) data.maxRetries = input.maxRetries;
    if (input.timeoutMs != null) data.timeoutMs = input.timeoutMs;
    if (input.asyncRequired != null) data.asyncRequired = input.asyncRequired;
    if (input.maxCostUsd !== undefined) data.maxCostUsd = input.maxCostUsd;
    if (input.fallbackToRules != null) data.fallbackToRules = input.fallbackToRules;
    if (input.conditionsJson !== undefined) {
      data.conditionsJson = toNullableInputJson(input.conditionsJson);
    }

    await prisma.aiRoute.update({
      where: { id },
      data,
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
        ...(input.triggerConfigJson != null
          ? { triggerConfigJson: toInputJson(input.triggerConfigJson) }
          : {}),
        fromProviderId: input.fromProviderId ?? null,
        toProviderId: input.toProviderId ?? null,
        fromModelId: input.fromModelId ?? null,
        toModelId: input.toModelId ?? null,
        action: input.action,
        ...(input.actionConfigJson != null
          ? { actionConfigJson: toInputJson(input.actionConfigJson) }
          : {}),
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

    const data: Prisma.AiFailoverRuleUncheckedUpdateInput = {
      updatedByUserId: actorUserId ?? null,
    };
    if (input.name != null) data.name = input.name;
    if (input.routeId !== undefined) data.routeId = input.routeId;
    if (input.enabled != null) data.enabled = input.enabled;
    if (input.priority != null) data.priority = input.priority;
    if (input.triggerType != null) data.triggerType = input.triggerType;
    if (input.triggerConfigJson !== undefined) {
      data.triggerConfigJson = toNullableInputJson(input.triggerConfigJson);
    }
    if (input.fromProviderId !== undefined) data.fromProviderId = input.fromProviderId;
    if (input.toProviderId !== undefined) data.toProviderId = input.toProviderId;
    if (input.fromModelId !== undefined) data.fromModelId = input.fromModelId;
    if (input.toModelId !== undefined) data.toModelId = input.toModelId;
    if (input.action != null) data.action = input.action;
    if (input.actionConfigJson !== undefined) {
      data.actionConfigJson = toNullableInputJson(input.actionConfigJson);
    }

    await prisma.aiFailoverRule.update({
      where: { id },
      data,
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
