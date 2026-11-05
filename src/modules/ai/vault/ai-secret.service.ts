import {
  AiApiKeyAuditAction,
  AiApiKeyStatus,
  type AiApiKey,
  type AiProvider,
  type Prisma,
} from '../../../generated/prisma/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.errors.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson } from '../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

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
import {
  isPlaceholderCiphertext,
  PLACEHOLDER_KEY_USER_MESSAGE,
} from './placeholder-secret.util.js';
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
    isPrimary: row.isPrimary,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    rotatedAt: row.rotatedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isPlaceholder: isPlaceholderCiphertext(row.encryptedSecret),
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
        isPrimary: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        encryptedSecret: true,
        provider: { select: { providerKey: true } },
      },
    });

    this.configuredProviders.clear();
    for (const row of rows) {
      if (isPlaceholderCiphertext(row.encryptedSecret)) continue;
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
        isPrimary: true,
        deletedAt: null,
        provider: { providerKey, enabled: true, deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      include: { provider: { select: { providerKey: true } } },
    });

    if (!row) return undefined;

    if (isPlaceholderCiphertext(row.encryptedSecret)) {
      return undefined;
    }

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

    const encryption = getEncryptionService();
    if (process.env.NODE_ENV === 'production' && !encryption.isMasterKeyConfigured()) {
      throw new ValidationError(
        'VAULT_NOT_CONFIGURED',
        'AI_VAULT_MASTER_KEY is required before storing API keys in production',
      );
    }

    const scopeKey = input.scopeKey ?? buildScopeKey(input.tenantId, input.branchId);
    const prisma = getPrisma();

    const provider = await prisma.aiProvider.findFirst({
      where: { scopeKey, providerKey: input.providerKey, deletedAt: null },
    });
    if (!provider) {
      throw new ValidationError('AI_PROVIDER_NOT_FOUND', `Provider ${input.providerKey} not found in scope`);
    }

    const { ciphertext, encryptionKeyId, encryptionAlgorithm } = encryption.encrypt(input.secret);

    const existingPrimary = await prisma.aiApiKey.findFirst({
      where: {
        providerId: provider.id,
        scopeKey,
        isPrimary: true,
        status: AiApiKeyStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const row = await prisma.aiApiKey.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        providerId: provider.id,
        name: input.name,
        status: AiApiKeyStatus.PENDING_TEST,
        isPrimary: !existingPrimary,
        encryptedSecret: ciphertext,
        encryptionKeyId,
        encryptionAlgorithm,
        secretHint: encryption.buildSecretHint(input.secret),
        expiresAt: input.expiresAt ?? null,
        createdByUserId: input.actor?.userId ?? null,
        updatedByUserId: input.actor?.userId ?? null,
      },
      include: { provider: { select: { providerKey: true } } },
    });

    await this.appendAudit(
      omitUndefined({
        apiKeyId: row.id,
        providerKey: provider.providerKey,
        action: AiApiKeyAuditAction.CREATED,
        actor: input.actor,
        reason: input.reason,
        metadataJson: { name: input.name, secretHint: row.secretHint },
      }),
    );

    await this.refreshConfigurationCache({ scopeKey });
    return toPublic({ ...row, provider });
  }

  async updateKey(id: string, input: UpdateAiApiKeyInput): Promise<AiApiKeyPublic> {
    const prisma = getPrisma();
    const existing = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!existing) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    const encryption = getEncryptionService();
    const data: Prisma.AiApiKeyUncheckedUpdateInput = {
      updatedByUserId: input.actor?.userId ?? null,
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
      data.status = AiApiKeyStatus.PENDING_TEST;
    }

    const row = await prisma.aiApiKey.update({
      where: { id },
      data,
      include: { provider: { select: { providerKey: true } } },
    });

    await this.appendAudit(
      omitUndefined({
        apiKeyId: row.id,
        providerKey: existing.provider.providerKey,
        action: AiApiKeyAuditAction.UPDATED,
        actor: input.actor,
        reason: input.reason,
        metadataJson: {
          name: row.name,
          secretRotated: input.secret !== undefined,
        },
      }),
    );

    await this.refreshConfigurationCache({ scopeKey: row.scopeKey });
    return toPublic({ ...row, provider: existing.provider });
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
        isPrimary: false,
        updatedByUserId: actor?.userId ?? null,
        version: { increment: 1 },
      },
    });

    await this.appendAudit(
      omitUndefined({
        apiKeyId: row.id,
        providerKey: existing.provider.providerKey,
        action: AiApiKeyAuditAction.DISABLED,
        actor,
        reason,
      }),
    );

    await this.refreshConfigurationCache({ scopeKey: row.scopeKey });
    return toPublic({ ...row, provider: existing.provider });
  }

  async testKey(id: string, actor?: AiSecretActor): Promise<AiApiKeyTestResult> {
    const prisma = getPrisma();
    const row = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true, baseUrl: true, adapterType: true } } },
    });
    if (!row) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    if (isPlaceholderCiphertext(row.encryptedSecret)) {
      const placeholderResult: AiApiKeyTestResult = {
        ok: false,
        providerKey: row.provider.providerKey,
        latencyMs: 0,
        errorCode: 'VAULT_PLACEHOLDER_SECRET',
        message: PLACEHOLDER_KEY_USER_MESSAGE,
      };
      await this.appendAudit(
        omitUndefined({
          apiKeyId: row.id,
          providerKey: row.provider.providerKey,
          action: AiApiKeyAuditAction.TESTED,
          actor,
          metadataJson: {
            ok: false,
            placeholder: true,
            errorCode: placeholderResult.errorCode,
          },
        }),
      );
      return placeholderResult;
    }

    const encryption = getEncryptionService();
    const secret = encryption.decrypt(row.encryptedSecret);
    const result = await testProviderApiKey(row.provider.providerKey, secret, row.provider.baseUrl);

    if (result.ok && row.status === AiApiKeyStatus.PENDING_TEST) {
      await prisma.aiApiKey.update({
        where: { id: row.id },
        data: {
          status: AiApiKeyStatus.ACTIVE,
          updatedByUserId: actor?.userId ?? null,
        },
      });
      await this.refreshConfigurationCache({ scopeKey: row.scopeKey });
    }

    if (result.ok) {
      await prisma.aiProvider.update({
        where: { id: row.providerId },
        data: {
          lastConnectionTestAt: new Date(),
          lastConnectionTestOk: true,
        },
      });
    } else {
      await prisma.aiProvider.update({
        where: { id: row.providerId },
        data: {
          lastConnectionTestAt: new Date(),
          lastConnectionTestOk: false,
        },
      });
    }

    await this.appendAudit(
      omitUndefined({
        apiKeyId: row.id,
        providerKey: row.provider.providerKey,
        action: AiApiKeyAuditAction.TESTED,
        actor,
        metadataJson: { ok: result.ok, latencyMs: result.latencyMs, errorCode: result.errorCode },
      }),
    );

    return { ...result, providerKey: row.provider.providerKey };
  }

  async setPrimaryKey(id: string, actor?: AiSecretActor, reason?: string): Promise<AiApiKeyPublic> {
    const prisma = getPrisma();
    const existing = await prisma.aiApiKey.findFirst({
      where: { id, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!existing) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');
    if (existing.status !== AiApiKeyStatus.ACTIVE) {
      throw new ValidationError('AI_API_KEY_NOT_ACTIVE', 'Only ACTIVE keys can be set as primary');
    }

    await prisma.$transaction([
      prisma.aiApiKey.updateMany({
        where: {
          providerId: existing.providerId,
          scopeKey: existing.scopeKey,
          isPrimary: true,
          deletedAt: null,
        },
        data: { isPrimary: false, updatedByUserId: actor?.userId ?? null },
      }),
      prisma.aiApiKey.update({
        where: { id },
        data: { isPrimary: true, updatedByUserId: actor?.userId ?? null },
      }),
    ]);

    await this.appendAudit(
      omitUndefined({
        apiKeyId: id,
        providerKey: existing.provider.providerKey,
        action: AiApiKeyAuditAction.UPDATED,
        actor,
        reason: reason ?? 'Set as primary key',
        metadataJson: { isPrimary: true },
      }),
    );

    await this.refreshConfigurationCache({ scopeKey: existing.scopeKey });
    return this.getKeyById(id);
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
      data: omitUndefined({
        apiKeyId: params.apiKeyId,
        providerKey: params.providerKey,
        action: params.action,
        actorUserId: params.actor?.userId ?? null,
        actorRole: params.actor?.role ?? null,
        reason: params.reason,
        metadataJson:
          params.metadataJson != null ? toInputJson(params.metadataJson) : undefined,
        ipAddress: params.actor?.ipAddress ?? null,
      }),
    });
  }

  validatePlaintextSecret(secret: string, providerKey: string): void {
    const trimmed = secret.trim();
    if (isPlaceholderCiphertext(trimmed)) {
      throw new ValidationError(
        'AI_API_KEY_INVALID',
        'Cannot store a seed/demo placeholder as an API key — paste a real provider secret',
      );
    }
    if (trimmed.length < 20) {
      throw new ValidationError('AI_API_KEY_INVALID', 'API key is too short');
    }

    if (providerKey === 'openai' && !trimmed.startsWith('sk-')) {
      throw new ValidationError('AI_API_KEY_INVALID', 'OpenAI key must start with sk-');
    }
    if (providerKey === 'anthropic' && !trimmed.startsWith('sk-ant-')) {
      throw new ValidationError('AI_API_KEY_INVALID', 'Anthropic key must start with sk-ant-');
    }
    if (providerKey === 'groq' && !trimmed.startsWith('gsk_')) {
      throw new ValidationError('AI_API_KEY_INVALID', 'Groq key must start with gsk_');
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
