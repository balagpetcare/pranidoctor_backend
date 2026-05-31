import type { AiModel, AiModelFamily, Prisma } from '../../../generated/prisma/index.js';
import { AiModelSource } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson, toNullableInputJson } from '../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { createAuditLog } from '../../../shared/security/audit/audit.service.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';
import type { AiAdminActor } from '../admin/ai-admin.guard.js';
import type { z } from 'zod';
import type {
  createModelSchema,
  updateModelSchema,
  updateModelRatesSchema,
} from '../admin/ai-admin.schemas.js';
import {
  getAiCapabilityMatrixService,
  parseModelMetadata,
} from './ai-capability-matrix.service.js';
import { getAiModelCostService } from './ai-model-cost.service.js';
import {
  AI_MODEL_FAMILIES,
  AI_MODEL_FAMILY_LABELS,
  type AiModelAdminDto,
  type AiModelFamilySummary,
  type AiModelLifecycle,
  type AiModelWithProvider,
} from './ai-model.types.js';
import {
  BUILTIN_FAMILY_MODEL_MANIFESTS,
  inferModelFamily,
} from './manifests/builtin-family-manifests.js';
import { withAiAdminDiagnostics } from '../admin/ai-admin-diagnostics.js';

type CreateModelInput = z.infer<typeof createModelSchema>;
type UpdateModelInput = z.infer<typeof updateModelSchema>;
type UpdateRatesInput = z.infer<typeof updateModelRatesSchema>;

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

function computeLifecycle(row: Pick<AiModel, 'enabled' | 'deprecatedAt' | 'retiredAt'>): AiModelLifecycle {
  if (row.retiredAt) return 'retired';
  if (row.deprecatedAt) return 'deprecated';
  if (row.enabled) return 'enabled';
  return 'registered';
}

function toAdminDto(row: AiModelWithProvider): AiModelAdminDto {
  const capSvc = getAiCapabilityMatrixService();
  const capabilities = capSvc.normalize(row.capabilitiesJson);
  return {
    id: row.id,
    scopeKey: row.scopeKey,
    providerId: row.providerId,
    providerKey: row.provider.providerKey,
    providerName: row.provider.displayName,
    modelKey: row.modelKey,
    externalModelId: row.externalModelId,
    modelFamily: row.modelFamily,
    displayName: row.displayName,
    modelType: row.modelType,
    modelCategory: row.modelCategory,
    enabled: row.enabled,
    isDefault: row.isDefault,
    lifecycle: computeLifecycle(row),
    contextWindow: row.contextWindow,
    maxInputTokens: row.maxInputTokens,
    maxOutputTokens: row.maxOutputTokens,
    contextWindowSource: row.contextWindowSource,
    capabilities,
    economics: {
      inputCostPerToken: Number(row.inputCostPerToken),
      outputCostPerToken: Number(row.outputCostPerToken),
      cachedInputCostPerToken:
        row.cachedInputCostPerToken != null ? Number(row.cachedInputCostPerToken) : null,
      batchInputCostPerToken:
        row.batchInputCostPerToken != null ? Number(row.batchInputCostPerToken) : null,
      batchOutputCostPerToken:
        row.batchOutputCostPerToken != null ? Number(row.batchOutputCostPerToken) : null,
      rateVersion: row.rateVersion,
      currency: row.currency,
    },
    metadata: parseModelMetadata(row.metadataJson),
    source: row.source,
    version: row.version,
    deprecatedAt: row.deprecatedAt?.toISOString() ?? null,
    retiredAt: row.retiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function logModelAudit(
  action:
    | 'AI_MODEL_CREATED'
    | 'AI_MODEL_UPDATED'
    | 'AI_MODEL_ENABLED'
    | 'AI_MODEL_DISABLED'
    | 'AI_MODEL_RATE_CHANGED'
    | 'AI_MODEL_DEFAULT_CHANGED'
    | 'AI_MODEL_CATALOG_SYNC',
  actor: AiAdminActor | { id: string; role?: string },
  model: Pick<AiModel, 'id' | 'modelKey'>,
  details?: Record<string, unknown>,
): void {
  void createAuditLog(
    omitUndefined({
      action,
      actorId: actor.id,
      ...(actor.role ? { actorRole: actor.role } : {}),
      targetType: 'ai_model',
      targetId: model.id,
      resourceType: 'ai_model',
      resourceId: model.id,
      details: { modelKey: model.modelKey, ...details },
    }),
  );
}

export class AiModelRegistryService {
  readonly name = 'AiModelRegistryService';

  async listModels(filters: {
    scopeKey?: string;
    providerId?: string;
    modelFamily?: AiModelFamily;
    enabled?: boolean;
  } = {}): Promise<AiModelAdminDto[]> {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'GET /api/admin/ai-ops/models',
        service: this.name,
        operation: 'listModels',
        requestPayload: filters,
      },
      async () => {
        const prisma = getPrisma();
        const scope = filters.scopeKey ?? PLATFORM_SCOPE_KEY;
        const rows = await prisma.aiModel.findMany({
          where: {
            scopeKey: scope,
            deletedAt: null,
            ...(filters.providerId ? { providerId: filters.providerId } : {}),
            ...(filters.modelFamily ? { modelFamily: filters.modelFamily } : {}),
            ...(filters.enabled != null ? { enabled: filters.enabled } : {}),
          },
          orderBy: [{ modelFamily: 'asc' }, { providerId: 'asc' }, { modelKey: 'asc' }],
          include: { provider: { select: { providerKey: true, displayName: true } } },
        });
        return rows.map((row) => toAdminDto(row));
      },
    );
  }

  async getModel(id: string): Promise<AiModelAdminDto> {
    const prisma = getPrisma();
    const row = await prisma.aiModel.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    if (!row) throw new Error('Model not found');
    return toAdminDto(row);
  }

  async createModel(input: CreateModelInput, actorUserId?: string): Promise<AiModelAdminDto> {
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

    const modelFamily =
      input.modelFamily ?? inferModelFamily(input.modelKey) ?? undefined;
    const capSvc = getAiCapabilityMatrixService();
    const capabilitiesPayload = capSvc.serialize(
      input.capabilities ?? capSvc.normalize(input.capabilitiesJson ?? []),
    );

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.aiModel.create({
        data: {
          scopeKey,
          tenantId: input.tenantId ?? null,
          branchId: input.branchId ?? null,
          providerId: input.providerId,
          modelKey: input.modelKey,
          displayName: input.displayName,
          modelFamily: modelFamily ?? null,
          modelType: input.modelType ?? 'chat',
          modelCategory: input.modelCategory ?? 'general_chat',
          contextWindow: input.contextWindow ?? null,
          maxInputTokens: input.maxInputTokens ?? null,
          maxOutputTokens: input.maxOutputTokens ?? null,
          contextWindowSource: input.contextWindowSource ?? 'ADVERTISED',
          inputCostPerToken: input.inputCostPerToken ?? 0,
          outputCostPerToken: input.outputCostPerToken ?? 0,
          cachedInputCostPerToken: input.cachedInputCostPerToken ?? null,
          currency: input.currency ?? 'USD',
          rateVersion: 1,
          enabled: false,
          isDefault: input.isDefault ?? false,
          source: AiModelSource.ADMIN,
          externalModelId: input.externalModelId ?? null,
          capabilitiesJson: capabilitiesPayload,
          ...(input.metadataJson != null ? { metadataJson: toInputJson(input.metadataJson) } : {}),
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
        },
        include: { provider: { select: { providerKey: true, displayName: true } } },
      });

      await tx.aiModelRateHistory.create({
        data: {
          modelId: created.id,
          rateVersion: 1,
          inputCostPerToken: created.inputCostPerToken,
          outputCostPerToken: created.outputCostPerToken,
          cachedInputCostPerToken: created.cachedInputCostPerToken,
          currency: created.currency,
          changedByUserId: actorUserId ?? null,
          source: 'admin',
          changeReason: 'Initial model registration',
        },
      });

      return created;
    });

    getAiCostRateService().invalidateCache();
    if (actorUserId) {
      logModelAudit('AI_MODEL_CREATED', { id: actorUserId }, row);
    }
    return toAdminDto(row);
  }

  async updateModel(id: string, input: UpdateModelInput, actorUserId?: string): Promise<AiModelAdminDto> {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    if (!existing) throw new Error('Model not found');

    if (input.enabled != null) {
      throw new Error('Use POST /models/[id]/enable or /disable to change enablement');
    }
    if (
      input.inputCostPerToken != null ||
      input.outputCostPerToken != null ||
      input.cachedInputCostPerToken !== undefined
    ) {
      throw new Error('Use PUT /models/[id]/rates to update economics');
    }
    if (input.isDefault != null) {
      throw new Error('Use POST /models/[id]/default to set the default model');
    }

    const capSvc = getAiCapabilityMatrixService();
    const data: Prisma.AiModelUncheckedUpdateInput = {
      updatedByUserId: actorUserId ?? null,
      version: { increment: 1 },
    };
    if (input.displayName != null) data.displayName = input.displayName;
    if (input.modelFamily != null) data.modelFamily = input.modelFamily;
    if (input.modelType != null) data.modelType = input.modelType;
    if (input.modelCategory != null) data.modelCategory = input.modelCategory;
    if (input.contextWindow !== undefined) data.contextWindow = input.contextWindow;
    if (input.maxInputTokens !== undefined) data.maxInputTokens = input.maxInputTokens;
    if (input.maxOutputTokens !== undefined) data.maxOutputTokens = input.maxOutputTokens;
    if (input.contextWindowSource != null) data.contextWindowSource = input.contextWindowSource;
    if (input.externalModelId !== undefined) data.externalModelId = input.externalModelId;
    if (input.capabilities != null) {
      data.capabilitiesJson = capSvc.serialize(input.capabilities);
    } else if (input.capabilitiesJson != null) {
      data.capabilitiesJson = capSvc.serialize(capSvc.normalize(input.capabilitiesJson));
    }
    if (input.metadataJson !== undefined) {
      data.metadataJson = toNullableInputJson(input.metadataJson);
    }
    if (input.deprecatedAt !== undefined) {
      data.deprecatedAt = input.deprecatedAt ? new Date(input.deprecatedAt) : null;
    }

    const row = await prisma.aiModel.update({
      where: { id },
      data,
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });

    if (actorUserId) {
      logModelAudit('AI_MODEL_UPDATED', { id: actorUserId }, row);
    }
    return toAdminDto(row);
  }

  async enableModel(id: string, actor: AiAdminActor): Promise<AiModelAdminDto> {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'POST /api/admin/ai-ops/models/:id/enable',
        service: this.name,
        operation: 'enableModel',
        requestPayload: { id, actorId: actor.id },
      },
      async () => {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({
      where: { id, deletedAt: null },
      include: {
        provider: { select: { providerKey: true, displayName: true, enabled: true } },
      },
    });
    if (!existing) throw new Error('Model not found');
    if (existing.retiredAt) throw new Error('Cannot enable a retired model');
    if (existing.deprecatedAt) throw new Error('Cannot enable a deprecated model');
    if (!existing.provider.enabled) {
      throw new Error('Provider must be enabled before enabling its models');
    }

    const row = await prisma.aiModel.update({
      where: { id },
      data: { enabled: true, updatedByUserId: actor.id },
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    getAiCostRateService().invalidateCache();
    logModelAudit('AI_MODEL_ENABLED', actor, row);
    return toAdminDto(row);
      },
    );
  }

  async disableModel(id: string, actor: AiAdminActor): Promise<AiModelAdminDto> {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'POST /api/admin/ai-ops/models/:id/disable',
        service: this.name,
        operation: 'disableModel',
        requestPayload: { id, actorId: actor.id },
      },
      async () => {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Model not found');

    const row = await prisma.aiModel.update({
      where: { id },
      data: { enabled: false, updatedByUserId: actor.id },
      include: { provider: { select: { providerKey: true, displayName: true } } },
    });
    getAiCostRateService().invalidateCache();
    logModelAudit('AI_MODEL_DISABLED', actor, row);
    return toAdminDto(row);
      },
    );
  }

  async setDefaultModel(id: string, actor: AiAdminActor): Promise<AiModelAdminDto> {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Model not found');
    if (!existing.enabled) throw new Error('Model must be enabled before setting as default');

    const row = await prisma.$transaction(async (tx) => {
      await tx.aiModel.updateMany({
        where: {
          scopeKey: existing.scopeKey,
          providerId: existing.providerId,
          modelType: existing.modelType,
          isDefault: true,
          deletedAt: null,
          NOT: { id },
        },
        data: { isDefault: false },
      });
      return tx.aiModel.update({
        where: { id },
        data: { isDefault: true, updatedByUserId: actor.id },
        include: { provider: { select: { providerKey: true, displayName: true } } },
      });
    });

    logModelAudit('AI_MODEL_DEFAULT_CHANGED', actor, row, { modelType: row.modelType });
    return toAdminDto(row);
  }

  async updateRates(
    id: string,
    input: UpdateRatesInput,
    actor: AiAdminActor,
  ): Promise<AiModelAdminDto> {
    const prisma = getPrisma();
    const existing = await prisma.aiModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new Error('Model not found');

    await getAiModelCostService().updateRates(existing, omitUndefined(input), actor.id);
    logModelAudit('AI_MODEL_RATE_CHANGED', actor, existing, {
      rateVersion: existing.rateVersion + 1,
      changeReason: input.changeReason,
    });
    return this.getModel(id);
  }

  async listRateHistory(modelId: string) {
    await this.getModel(modelId);
    return getAiModelCostService().listRateHistory(modelId);
  }

  async listFamilies(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<AiModelFamilySummary[]> {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'GET /api/admin/ai-ops/models/families',
        service: this.name,
        operation: 'listFamilies',
        requestPayload: { scopeKey },
      },
      async () => {
        const prisma = getPrisma();
        const rows = await prisma.aiModel.findMany({
          where: { scopeKey, deletedAt: null, modelFamily: { not: null } },
          select: {
            modelFamily: true,
            enabled: true,
            provider: { select: { providerKey: true } },
          },
        });

        return AI_MODEL_FAMILIES.map((family) => {
          const familyRows = rows.filter((r) => r.modelFamily === family);
          const providers = [...new Set(familyRows.map((r) => r.provider.providerKey))];
          return {
            family,
            displayName: AI_MODEL_FAMILY_LABELS[family],
            modelCount: familyRows.length,
            enabledCount: familyRows.filter((r) => r.enabled).length,
            providers,
          };
        });
      },
    );
  }

  async listModelsByFamily(
    family: AiModelFamily,
    scopeKey: string = PLATFORM_SCOPE_KEY,
  ): Promise<AiModelAdminDto[]> {
    return this.listModels({ scopeKey, modelFamily: family });
  }

  async syncFromManifests(actor: AiAdminActor, scopeKey: string = PLATFORM_SCOPE_KEY): Promise<{ upserted: number }> {
    const prisma = getPrisma();
    const capSvc = getAiCapabilityMatrixService();
    let upserted = 0;

    for (const entry of BUILTIN_FAMILY_MODEL_MANIFESTS) {
      const provider = await prisma.aiProvider.findFirst({
        where: { scopeKey, providerKey: entry.providerKey, deletedAt: null },
      });
      if (!provider) continue;

      const existing = await prisma.aiModel.findFirst({
        where: {
          scopeKey,
          providerId: provider.id,
          modelKey: entry.modelKey,
          deletedAt: null,
        },
      });

      const capabilitiesPayload = capSvc.serialize(entry.capabilities);

      if (existing) {
        await prisma.aiModel.update({
          where: { id: existing.id },
          data: {
            modelFamily: entry.modelFamily,
            displayName: entry.displayName,
            modelType: entry.modelType,
            modelCategory: entry.modelCategory,
            contextWindow: entry.contextWindow,
            maxOutputTokens: entry.maxOutputTokens,
            externalModelId: entry.externalModelId ?? null,
            capabilitiesJson: capabilitiesPayload,
            updatedByUserId: actor.id,
          },
        });
      } else {
        const created = await prisma.aiModel.create({
          data: {
            scopeKey,
            providerId: provider.id,
            modelKey: entry.modelKey,
            displayName: entry.displayName,
            modelFamily: entry.modelFamily,
            modelType: entry.modelType,
            modelCategory: entry.modelCategory,
            contextWindow: entry.contextWindow,
            maxOutputTokens: entry.maxOutputTokens,
            inputCostPerToken: entry.inputCostPerToken,
            outputCostPerToken: entry.outputCostPerToken,
            isDefault: entry.isDefault ?? false,
            enabled: false,
            source: AiModelSource.BUILTIN,
            externalModelId: entry.externalModelId ?? null,
            capabilitiesJson: capabilitiesPayload,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
          },
        });
        await prisma.aiModelRateHistory.create({
          data: {
            modelId: created.id,
            rateVersion: 1,
            inputCostPerToken: entry.inputCostPerToken,
            outputCostPerToken: entry.outputCostPerToken,
            changedByUserId: actor.id,
            source: 'seed',
            changeReason: 'Manifest sync',
          },
        });
      }
      upserted += 1;
    }

    getAiCostRateService().invalidateCache();
    logModelAudit('AI_MODEL_CATALOG_SYNC', actor, { id: 'manifest-sync', modelKey: 'manifest' }, {
      upserted,
      scopeKey,
    });
    return { upserted };
  }

  /** Backward-compatible toggle — delegates to enable/disable. */
  async toggleModel(id: string, enabled: boolean, actor: AiAdminActor): Promise<AiModelAdminDto> {
    return enabled ? this.enableModel(id, actor) : this.disableModel(id, actor);
  }
}

let registryService: AiModelRegistryService | null = null;

export function getAiModelRegistryService(): AiModelRegistryService {
  if (!registryService) registryService = new AiModelRegistryService();
  return registryService;
}

export function resetAiModelRegistryServiceForTests(): void {
  registryService = null;
}
