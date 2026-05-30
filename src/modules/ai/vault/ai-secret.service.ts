import {
  AiApiKeyAuditAction,
  AiApiKeyStatus,
  type AiApiKey,
  type AiProvider,
} from '../../../generated/prisma/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.errors.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import type {
  AddAiApiKeyInput,
  AiApiKeyAuditEntry,
  AiApiKeyPublic,
  AiApiKeyTestResult,
  AiSecretActor,
  AiSecretScope,
  UpdateAiApiKeyInput,
} from './ai-secret.types.js';
import { getEncryptionService } from './encryption.service.js';
import { testProviderApiKey } from './provider-key-test.js';

export const PLATFORM_SCOPE_KEY = 'platform';

export function buildScopeKey(tenantId?: string | null, branchId?: string | null): string {
  if (tenantId && branchId) return `tenant:${tenantId}:branch:${branchId}`;
  if (tenantId) return `tenant:${tenantId}`;
  return PLATFORM_SCOPE_KEY;
}

function toPublic(row: AiApiKey & { provider: Pick<AiProvider, 'providerKey'> }): AiApiKeyPublic {
  return {
    id: row.id,
    scopeKey: row.scopeKey,
    tenantId: row.tenantId,
    branchId: row.branchId,
    providerId: row.providerId,
    providerKey: row.provider.providerKey,
    name: row.name,
    status: row.status,
    encryptionKeyId: row.encryptionKeyId,
    encryptionAlgorithm: row.encryptionAlgorithm,
    secretHint: row.secretHint,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    rotatedAt: row.rotatedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class AiSecretService {
  readonly name = 'AiSecretService';

  private configuredProviders = new Map<string, boolean>();

  async refreshConfigurationCache(scope: AiSecretScope = {}): Promise<void> {
    const scopeKey = scope.scopeKey ?? buildScopeKey(scope.tenantId, scope.branchId);
    const prisma = getPrisma();

    const rows = await prisma.aiApiKey.findMany({
      where: {
        scopeKey,
        status: AiApiKeyStatus.ACTIVE,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { provider: { select: { providerKey: true } } },
    });

    this.configuredProviders.clear();
    for (const row of rows) {
      this.configuredProviders.set(row.provider.providerKey, true);
    }
  }

  isProviderConfigured(providerKey: string): boolean {
    return this.configuredProviders.get(providerKey) ?? false;
  }

  resetConfigurationCacheForTests(): void {
    this.configuredProviders.clear();
  }

  setProviderConfiguredForTests(providerKey: string, configured: boolean): void {
    this.configuredProviders.set(providerKey, configured);
  }

  /** Decrypt and return the active API key for a provider — runtime only. */
  async resolveProviderSecret(
    providerKey: string,
    scope: AiSecretScope = {},
  ): Promise<string | undefined> {
    const scopeKey = scope.scopeKey ?? buildScopeKey(scope.tenantId, scope.branchId);
    const prisma = getPrisma();

    const row = await prisma.aiApiKey.findFirst({
      where: {
        scopeKey,
        status: AiApiKeyStatus.ACTIVE,
        deletedAt: null,
        provider: { providerKey, enabled: true, deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      include: { provider: { select: { providerKey: true } } },
    });

    if (!row) return undefined;

    const encryption = getEncryptionService();
    const secret = encryption.decrypt(row.encryptedSecret);

    await prisma.aiApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return secret;
  }

  async listKeys(scope: AiSecretScope = {}): Promise<AiApiKeyPublic[]> {
    const scopeKey = scope.scopeKey ?? buildScopeKey(scope.tenantId, scope.branchId);
    const prisma = getPrisma();

    const rows = await prisma.aiApiKey.findMany({
      where: { scopeKey, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
      orderBy: [{ provider: { providerKey: 'asc' } }, { createdAt: 'desc' }],
    });

    return rows.map(toPublic);
  }

  async getKeyById(id: string): Promise<AiApiKeyPublic> {
    const prisma = getPrisma();
    const row = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!row) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');
    return toPublic(row);
  }

  async addKey(input: AddAiApiKeyInput): Promise<AiApiKeyPublic> {
    this.validatePlaintextSecret(input.secret, input.providerKey);

    const scopeKey = input.scopeKey ?? buildScopeKey(input.tenantId, input.branchId);
    const prisma = getPrisma();
    const encryption = getEncryptionService();

    const provider = await prisma.aiProvider.findFirst({
      where: { scopeKey, providerKey: input.providerKey, deletedAt: null },
    });
    if (!provider) {
      throw new ValidationError('AI_PROVIDER_NOT_FOUND', `Provider ${input.providerKey} not found in scope`);
    }

    const { ciphertext, encryptionKeyId, encryptionAlgorithm } = encryption.encrypt(input.secret);

    const row = await prisma.aiApiKey.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        providerId: provider.id,
        name: input.name,
        status: AiApiKeyStatus.ACTIVE,
        encryptedSecret: ciphertext,
        encryptionKeyId,
        encryptionAlgorithm,
        secretHint: encryption.buildSecretHint(input.secret),
        expiresAt: input.expiresAt ?? null,
        createdByUserId: input.actor?.userId,
        updatedByUserId: input.actor?.userId,
      },
      include: { provider: { select: { providerKey: true } } },
    });

    await this.appendAudit({
      apiKeyId: row.id,
      providerKey: provider.providerKey,
      action: AiApiKeyAuditAction.CREATED,
      actor: input.actor,
      reason: input.reason,
      metadataJson: { name: input.name, secretHint: row.secretHint },
    });

    await this.refreshConfigurationCache({ scopeKey });
    return toPublic(row);
  }

  async updateKey(id: string, input: UpdateAiApiKeyInput): Promise<AiApiKeyPublic> {
    const prisma = getPrisma();
    const existing = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!existing) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    const encryption = getEncryptionService();
    const data: {
      name?: string;
      expiresAt?: Date | null;
      encryptedSecret?: string;
      encryptionKeyId?: string;
      encryptionAlgorithm?: string;
      secretHint?: string;
      version?: { increment: number };
      updatedByUserId?: string;
    } = {
      updatedByUserId: input.actor?.userId,
      version: { increment: 1 },
    };

    if (input.name !== undefined) data.name = input.name;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;

    if (input.secret !== undefined) {
      this.validatePlaintextSecret(input.secret, existing.provider.providerKey);
      const enc = encryption.encrypt(input.secret);
      data.encryptedSecret = enc.ciphertext;
      data.encryptionKeyId = enc.encryptionKeyId;
      data.encryptionAlgorithm = enc.encryptionAlgorithm;
      data.secretHint = encryption.buildSecretHint(input.secret);
    }

    const row = await prisma.aiApiKey.update({
      where: { id },
      data,
      include: { provider: { select: { providerKey: true } } },
    });

    await this.appendAudit({
      apiKeyId: row.id,
      providerKey: row.provider.providerKey,
      action: AiApiKeyAuditAction.UPDATED,
      actor: input.actor,
      reason: input.reason,
      metadataJson: {
        name: row.name,
        secretRotated: input.secret !== undefined,
      },
    });

    await this.refreshConfigurationCache({ scopeKey: row.scopeKey });
    return toPublic(row);
  }

  async disableKey(id: string, actor?: AiSecretActor, reason?: string): Promise<AiApiKeyPublic> {
    const prisma = getPrisma();
    const existing = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!existing) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    const row = await prisma.aiApiKey.update({
      where: { id },
      data: {
        status: AiApiKeyStatus.REVOKED,
        revokedAt: new Date(),
        updatedByUserId: actor?.userId,
        version: { increment: 1 },
      },
      include: { provider: { select: { providerKey: true } } },
    });

    await this.appendAudit({
      apiKeyId: row.id,
      providerKey: row.provider.providerKey,
      action: AiApiKeyAuditAction.DISABLED,
      actor,
      reason,
    });

    await this.refreshConfigurationCache({ scopeKey: row.scopeKey });
    return toPublic(row);
  }

  async testKey(id: string, actor?: AiSecretActor): Promise<AiApiKeyTestResult> {
    const prisma = getPrisma();
    const row = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true, baseUrl: true, adapterType: true } } },
    });
    if (!row) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    const encryption = getEncryptionService();
    const secret = encryption.decrypt(row.encryptedSecret);
    const result = await testProviderApiKey(row.provider.providerKey, secret, row.provider.baseUrl);

    await this.appendAudit({
      apiKeyId: row.id,
      providerKey: row.provider.providerKey,
      action: AiApiKeyAuditAction.TESTED,
      actor,
      metadataJson: { ok: result.ok, latencyMs: result.latencyMs, errorCode: result.errorCode },
    });

    return { ...result, providerKey: row.provider.providerKey };
  }

  async listAuditLog(apiKeyId: string, limit = 50): Promise<AiApiKeyAuditEntry[]> {
    const prisma = getPrisma();
    const rows = await prisma.aiApiKeyAuditLog.findMany({
      where: { apiKeyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    return rows.map((r) => ({
      id: r.id,
      apiKeyId: r.apiKeyId,
      providerKey: r.providerKey,
      action: r.action,
      actorUserId: r.actorUserId,
      actorRole: r.actorRole,
      reason: r.reason,
      metadataJson: r.metadataJson,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async appendAudit(params: {
    apiKeyId: string;
    providerKey: string;
    action: AiApiKeyAuditAction;
    actor?: AiSecretActor;
    reason?: string;
    metadataJson?: unknown;
  }): Promise<void> {
    const prisma = getPrisma();
    await prisma.aiApiKeyAuditLog.create({
      data: {
        apiKeyId: params.apiKeyId,
        providerKey: params.providerKey,
        action: params.action,
        actorUserId: params.actor?.userId,
        actorRole: params.actor?.role,
        reason: params.reason,
        metadataJson: params.metadataJson as object | undefined,
        ipAddress: params.actor?.ipAddress,
      },
    });
  }

  validatePlaintextSecret(secret: string, providerKey: string): void {
    const trimmed = secret.trim();
    if (trimmed.length < 20) {
      throw new ValidationError('AI_API_KEY_INVALID', 'API key is too short');
    }

    if (providerKey === 'openai' && !trimmed.startsWith('sk-')) {
      throw new ValidationError('AI_API_KEY_INVALID', 'OpenAI key must start with sk-');
    }
    if (providerKey === 'anthropic' && !trimmed.startsWith('sk-ant-')) {
      throw new ValidationError('AI_API_KEY_INVALID', 'Anthropic key must start with sk-ant-');
    }
  }
}

let aiSecretService: AiSecretService | null = null;

export function getAiSecretService(): AiSecretService {
  if (!aiSecretService) aiSecretService = new AiSecretService();
  return aiSecretService;
}

export function resetAiSecretServiceForTests(): void {
  aiSecretService = null;
}
