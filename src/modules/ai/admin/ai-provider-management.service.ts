import type { AiProvider, AiApiKey, Prisma } from '../../../generated/prisma/index.js';
import { AiApiKeyStatus } from '../../../generated/prisma/index.js';
import { getConfig } from '../../../shared/config/config.loader.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { createAuditLog } from '../../../shared/security/audit/audit.service.js';
import { getAiGovernanceService } from '../governance/ai-governance.service.js';
import { getEncryptionService } from '../vault/encryption.service.js';
import { getAiSecretService } from '../vault/ai-secret.service.js';
import type {
  AiConnectionTestResult,
  AiProviderAdminDto,
  AiProviderEffectiveStatus,
  AiProviderKeySummary,
  AiSecretActor,
} from '../vault/ai-secret.types.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';
import type { AiAdminActor } from './ai-admin.guard.js';
import { getAiRegistryAdminService } from './ai-registry-admin.service.js';
import type { z } from 'zod';
import type { createProviderSchema, updateProviderSchema } from './ai-admin.schemas.js';
import { withAiAdminDiagnostics } from './ai-admin-diagnostics.js';

type CreateProviderInput = z.infer<typeof createProviderSchema>;
type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

const DEGRADED_HEALTH_THRESHOLD = 0.5;
const CONNECTION_TEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function logProviderAudit(
  action: 'AI_PROVIDER_ENABLED' | 'AI_PROVIDER_DISABLED' | 'AI_PROVIDER_PRIORITY_CHANGED' | 'AI_REGISTRY_CHANGE',
  actor: AiAdminActor,
  provider: Pick<AiProvider, 'id' | 'providerKey'>,
  details?: Record<string, unknown>,
): void {
  void createAuditLog({
    action,
    actorId: actor.id,
    actorRole: actor.role,
    targetType: 'ai_provider',
    targetId: provider.id,
    resourceType: 'ai_provider',
    resourceId: provider.id,
    details: { providerKey: provider.providerKey, ...details },
  });
}

async function isProviderGovernanceBlocked(providerKey: string): Promise<boolean> {
  return getAiGovernanceService().isProviderDisabled(providerKey);
}

function buildKeySummary(keys: AiApiKey[]): AiProviderKeySummary {
  const active = keys.filter((k) => k.status === AiApiKeyStatus.ACTIVE && !k.deletedAt);
  const pending = keys.filter((k) => k.status === AiApiKeyStatus.PENDING_TEST && !k.deletedAt);
  const primary = active.find((k) => k.isPrimary);
  return {
    hasPrimary: Boolean(primary),
    primaryKeyId: primary?.id ?? null,
    hint: primary?.secretHint ?? null,
    expiresAt: primary?.expiresAt?.toISOString() ?? null,
    pendingTestCount: pending.length,
    activeCount: active.length,
  };
}

function computeEffectiveStatus(
  row: AiProvider,
  keySummary: AiProviderKeySummary,
  governanceBlocked: boolean,
): AiProviderEffectiveStatus {
  if (governanceBlocked) return 'BLOCKED';
  if (!row.enabled) return 'DISABLED';
  if (!keySummary.hasPrimary && keySummary.pendingTestCount === 0) return 'UNCONFIGURED';
  if (row.healthScore < DEGRADED_HEALTH_THRESHOLD) return 'DEGRADED';
  if (keySummary.hasPrimary || keySummary.pendingTestCount > 0) return 'ACTIVE';
  return 'UNCONFIGURED';
}

async function toAdminDto(
  row: AiProvider & { _count?: { models: number; apiKeys: number } },
  keys: AiApiKey[],
  governanceBlocked: boolean,
): Promise<AiProviderAdminDto> {
  const keySummary = buildKeySummary(keys);
  return {
    id: row.id,
    scopeKey: row.scopeKey,
    providerKey: row.providerKey,
    displayName: row.displayName,
    description: row.description,
    enabled: row.enabled,
    effectiveStatus: computeEffectiveStatus(row, keySummary, governanceBlocked),
    priority: row.priority,
    adapterType: row.adapterType,
    baseUrl: row.baseUrl,
    costTier: row.costTier,
    healthScore: row.healthScore,
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    lastConnectionTestAt: row.lastConnectionTestAt?.toISOString() ?? null,
    lastConnectionTestOk: row.lastConnectionTestOk ?? null,
    capabilitiesJson: row.capabilitiesJson,
    configJson: row.configJson,
    modelCount: row._count?.models ?? 0,
    apiKeyCount: row._count?.apiKeys ?? 0,
    keySummary,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AiProviderManagementService {
  readonly name = 'AiProviderManagementService';

  async listProviders(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<AiProviderAdminDto[]> {
    return withAiAdminDiagnostics(
      {
        layer: 'service',
        route: 'GET /api/admin/ai-ops/providers',
        service: this.name,
        operation: 'listProviders',
        requestPayload: { scopeKey },
      },
      async () => {
    const prisma = getPrisma();
    const rows = await prisma.aiProvider.findMany({
      where: { scopeKey, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { providerKey: 'asc' }],
      include: { _count: { select: { models: true, apiKeys: true } } },
    });

    const keys = await prisma.aiApiKey.findMany({
      where: { scopeKey, deletedAt: null },
    });
    const keysByProvider = new Map<string, AiApiKey[]>();
    for (const key of keys) {
      const list = keysByProvider.get(key.providerId) ?? [];
      list.push(key);
      keysByProvider.set(key.providerId, list);
    }

    const result: AiProviderAdminDto[] = [];
    for (const row of rows) {
      const blocked = await isProviderGovernanceBlocked(row.providerKey);
      result.push(await toAdminDto(row, keysByProvider.get(row.id) ?? [], blocked));
    }
    return result;
      },
    );
  }

  async getProvider(id: string): Promise<AiProviderAdminDto> {
    const prisma = getPrisma();
    const row = await prisma.aiProvider.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { models: true, apiKeys: true } } },
    });
    if (!row) throw new Error('Provider not found');

    const keys = await prisma.aiApiKey.findMany({
      where: { providerId: id, deletedAt: null },
    });
    const blocked = await isProviderGovernanceBlocked(row.providerKey);
    return toAdminDto(row, keys, blocked);
  }

  async createProvider(input: CreateProviderInput, actor: AiAdminActor) {
    const data = await getAiRegistryAdminService().createProvider(
      { ...input, enabled: input.enabled ?? false },
      actor.id,
    );
    logProviderAudit('AI_REGISTRY_CHANGE', actor, { id: data.id, providerKey: data.providerKey }, {
      operation: 'create',
    });
    return this.getProvider(data.id);
  }

  async updateProvider(id: string, input: UpdateProviderInput, actor: AiAdminActor) {
    const existing = await this.getProvider(id);
    if (input.enabled === true) {
      throw new Error('Use POST /providers/[id]/enable to enable a provider (requires connection test)');
    }
    if (input.enabled === false) {
      return this.disableProvider(id, actor);
    }
    const { enabled: _ignored, ...rest } = input;
    await getAiRegistryAdminService().updateProvider(id, rest, actor.id);
    logProviderAudit('AI_REGISTRY_CHANGE', actor, { id, providerKey: existing.providerKey }, {
      operation: 'update',
      fields: Object.keys(input),
    });
    return this.getProvider(id);
  }

  private assertCanEnable(row: AiProvider, keySummary: AiProviderKeySummary): void {
    const config = getConfig();
    if (config.nodeEnv === 'production' && !getEncryptionService().isMasterKeyConfigured()) {
      throw new Error('AI_VAULT_MASTER_KEY must be configured before enabling providers in production');
    }
    if (!keySummary.hasPrimary) {
      throw new Error('Provider requires an active primary API key before enable');
    }
    if (row.lastConnectionTestOk !== true || !row.lastConnectionTestAt) {
      throw new Error('Provider requires a successful connection test before enable');
    }
    const age = Date.now() - row.lastConnectionTestAt.getTime();
    if (age > CONNECTION_TEST_MAX_AGE_MS) {
      throw new Error('Connection test is stale — run test-connection again (max age 24h)');
    }
  }

  async enableProvider(id: string, actor: AiAdminActor): Promise<AiProviderAdminDto> {
    const prisma = getPrisma();
    const row = await prisma.aiProvider.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new Error('Provider not found');

    if (await isProviderGovernanceBlocked(row.providerKey)) {
      throw new Error('Provider is blocked by governance — clear governance scope first');
    }

    const keys = await prisma.aiApiKey.findMany({ where: { providerId: id, deletedAt: null } });
    const keySummary = buildKeySummary(keys);
    this.assertCanEnable(row, keySummary);

    await prisma.aiProvider.update({
      where: { id },
      data: { enabled: true, updatedByUserId: actor.id },
    });

    logProviderAudit('AI_PROVIDER_ENABLED', actor, row);
    await getAiSecretService().refreshConfigurationCache({ scopeKey: row.scopeKey });
    return this.getProvider(id);
  }

  async disableProvider(id: string, actor: AiAdminActor): Promise<AiProviderAdminDto> {
    const prisma = getPrisma();
    const row = await prisma.aiProvider.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new Error('Provider not found');

    await prisma.aiProvider.update({
      where: { id },
      data: { enabled: false, updatedByUserId: actor.id },
    });

    logProviderAudit('AI_PROVIDER_DISABLED', actor, row);
    await getAiSecretService().refreshConfigurationCache({ scopeKey: row.scopeKey });
    return this.getProvider(id);
  }

  async updatePriorities(
    items: Array<{ id: string; priority: number }>,
    actor: AiAdminActor,
  ): Promise<AiProviderAdminDto[]> {
    const prisma = getPrisma();
    const updates: Prisma.PrismaPromise<AiProvider>[] = items.map((item) =>
      prisma.aiProvider.update({
        where: { id: item.id },
        data: { priority: item.priority, updatedByUserId: actor.id },
      }),
    );
    await prisma.$transaction(updates);

    logProviderAudit(
      'AI_PROVIDER_PRIORITY_CHANGED',
      actor,
      { id: 'batch', providerKey: 'multiple' },
      { items },
    );

    const scopeKey = items.length
      ? (await prisma.aiProvider.findFirst({ where: { id: items[0]!.id } }))?.scopeKey ??
        PLATFORM_SCOPE_KEY
      : PLATFORM_SCOPE_KEY;
    return this.listProviders(scopeKey);
  }

  async testProviderConnection(
    providerId: string,
    actor?: AiSecretActor,
  ): Promise<AiConnectionTestResult> {
    const prisma = getPrisma();
    const provider = await prisma.aiProvider.findFirst({
      where: { id: providerId, deletedAt: null },
    });
    if (!provider) throw new Error('Provider not found');

    const key =
      (await prisma.aiApiKey.findFirst({
        where: {
          providerId,
          deletedAt: null,
          status: { in: [AiApiKeyStatus.ACTIVE, AiApiKeyStatus.PENDING_TEST] },
          isPrimary: true,
        },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      })) ??
      (await prisma.aiApiKey.findFirst({
        where: {
          providerId,
          deletedAt: null,
          status: { in: [AiApiKeyStatus.ACTIVE, AiApiKeyStatus.PENDING_TEST] },
        },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      }));

    if (!key) throw new Error('No API key configured for provider');

    const result = await getAiSecretService().testKey(key.id, actor);

    await prisma.aiProvider.update({
      where: { id: providerId },
      data: {
        lastConnectionTestAt: new Date(),
        lastConnectionTestOk: result.ok,
        updatedByUserId: actor?.userId ?? null,
      },
    });

    return {
      ...result,
      providerId,
      apiKeyId: key.id,
      testedAt: new Date().toISOString(),
      probeType: 'manual',
    };
  }

  async getStatusBoard(scopeKey: string = PLATFORM_SCOPE_KEY) {
    const providers = await this.listProviders(scopeKey);
    return {
      scopeKey,
      checkedAt: new Date().toISOString(),
      summary: {
        total: providers.length,
        active: providers.filter((p) => p.effectiveStatus === 'ACTIVE' && p.enabled).length,
        disabled: providers.filter((p) => p.effectiveStatus === 'DISABLED').length,
        unconfigured: providers.filter((p) => p.effectiveStatus === 'UNCONFIGURED').length,
        blocked: providers.filter((p) => p.effectiveStatus === 'BLOCKED').length,
        degraded: providers.filter((p) => p.effectiveStatus === 'DEGRADED').length,
      },
      providers,
    };
  }
}

let service: AiProviderManagementService | null = null;

export function getAiProviderManagementService(): AiProviderManagementService {
  if (!service) service = new AiProviderManagementService();
  return service;
}

export function resetAiProviderManagementServiceForTests(): void {
  service = null;
}
