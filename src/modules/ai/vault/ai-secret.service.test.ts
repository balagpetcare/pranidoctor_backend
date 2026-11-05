import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiApiKeyAuditAction, AiApiKeyStatus } from '../../../generated/prisma/index.js';
import { AiSecretService, resetAiSecretServiceForTests } from './ai-secret.service.js';
import { resetEncryptionServiceForTests } from './encryption.service.js';

const prismaMock = {
  aiApiKey: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  aiProvider: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  aiApiKeyAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

vi.mock('./provider-key-test.js', () => ({
  testProviderApiKey: vi.fn().mockResolvedValue({ ok: true, latencyMs: 120 }),
}));

describe('AiSecretService', () => {
  let service: AiSecretService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAiSecretServiceForTests();
    resetEncryptionServiceForTests();
    process.env.AI_VAULT_MASTER_KEY = Buffer.alloc(32, 3).toString('base64');
    service = new AiSecretService();
  });

  afterEach(() => {
    delete process.env.AI_VAULT_MASTER_KEY;
    resetAiSecretServiceForTests();
    resetEncryptionServiceForTests();
  });

  it('refreshes configured provider cache from active keys', async () => {
    prismaMock.aiApiKey.findMany.mockResolvedValue([
      { provider: { providerKey: 'openai' } },
      { provider: { providerKey: 'anthropic' } },
    ]);

    await service.refreshConfigurationCache();
    expect(service.isProviderConfigured('openai')).toBe(true);
    expect(service.isProviderConfigured('anthropic')).toBe(true);
    expect(service.isProviderConfigured('gemini')).toBe(false);
  });

  it('addKey encrypts secret and writes audit log', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'prov-1',
      providerKey: 'openai',
    });
    prismaMock.aiApiKey.findFirst.mockResolvedValue(null);
    prismaMock.aiApiKey.create.mockResolvedValue({
      id: 'key-1',
      scopeKey: 'platform',
      tenantId: null,
      branchId: null,
      providerId: 'prov-1',
      name: 'default',
      status: AiApiKeyStatus.PENDING_TEST,
      isPrimary: true,
      encryptedSecret: 'v1:a:b:c',
      encryptionKeyId: 'vault:v1',
      encryptionAlgorithm: 'aes-256-gcm',
      secretHint: '****cdef',
      expiresAt: null,
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: { providerKey: 'openai' },
    });
    prismaMock.aiApiKeyAuditLog.create.mockResolvedValue({});
    prismaMock.aiApiKey.findMany.mockResolvedValue([{ provider: { providerKey: 'openai' } }]);

    const result = await service.addKey({
      providerKey: 'openai',
      name: 'default',
      secret: 'sk-test-openai-key-1234567890',
      actor: { userId: 'admin-1', role: 'SUPER_ADMIN' },
    });

    expect(result.providerKey).toBe('openai');
    expect(result.isPlaceholder).toBe(false);
    expect(result.secretHint).toBe('****cdef');
    expect(prismaMock.aiApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiApiKeyStatus.PENDING_TEST,
          isPrimary: true,
          encryptedSecret: expect.stringMatching(/^v1:/),
          secretHint: expect.any(String),
        }),
      }),
    );
    expect(prismaMock.aiApiKeyAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AiApiKeyAuditAction.CREATED }),
      }),
    );
  });

  it('resolveProviderSecret decrypts active key', async () => {
    const { getEncryptionService } = await import('./encryption.service.js');
    const enc = getEncryptionService().encrypt('sk-test-openai-key-1234567890');

    prismaMock.aiApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      isPrimary: true,
      encryptedSecret: enc.ciphertext,
      provider: { providerKey: 'openai' },
    });
    prismaMock.aiApiKey.update.mockResolvedValue({});

    const secret = await service.resolveProviderSecret('openai');
    expect(secret).toBe('sk-test-openai-key-1234567890');
    expect(prismaMock.aiApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'key-1' } }),
    );
  });

  it('disableKey revokes and audits', async () => {
    prismaMock.aiApiKey.findFirst.mockResolvedValue({
      id: 'key-1',
      scopeKey: 'platform',
      provider: { providerKey: 'openai' },
    });
    prismaMock.aiApiKey.update.mockResolvedValue({
      id: 'key-1',
      scopeKey: 'platform',
      tenantId: null,
      branchId: null,
      providerId: 'prov-1',
      name: 'default',
      status: AiApiKeyStatus.REVOKED,
      encryptedSecret: 'v1:a:b:c',
      encryptionKeyId: 'vault:v1',
      encryptionAlgorithm: 'aes-256-gcm',
      secretHint: '****cdef',
      expiresAt: null,
      rotatedAt: null,
      revokedAt: new Date(),
      lastUsedAt: null,
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      provider: { providerKey: 'openai' },
    });
    prismaMock.aiApiKeyAuditLog.create.mockResolvedValue({});
    prismaMock.aiApiKey.findMany.mockResolvedValue([]);

    const result = await service.disableKey('key-1', { userId: 'admin-1' }, 'compromised');
    expect(result.status).toBe(AiApiKeyStatus.REVOKED);
    expect(prismaMock.aiApiKeyAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AiApiKeyAuditAction.DISABLED }),
      }),
    );
  });

  it('testKey returns friendly result for placeholder ciphertext without decrypting', async () => {
    prismaMock.aiApiKey.findFirst.mockResolvedValue({
      id: 'key-seed',
      status: AiApiKeyStatus.ACTIVE,
      encryptedSecret: 'ENC:PLACEHOLDER:v1:not-a-real-api-key',
      providerId: 'prov-1',
      scopeKey: 'platform',
      provider: { providerKey: 'openai', baseUrl: 'https://api.openai.com/v1', adapterType: 'openai_native' },
    });
    prismaMock.aiApiKeyAuditLog.create.mockResolvedValue({});

    const { testProviderApiKey } = await import('./provider-key-test.js');
    const result = await service.testKey('key-seed', { userId: 'admin-1' });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('VAULT_PLACEHOLDER_SECRET');
    expect(result.message).toMatch(/seed\/demo/i);
    expect(testProviderApiKey).not.toHaveBeenCalled();
    expect(prismaMock.aiApiKeyAuditLog.create).toHaveBeenCalled();
  });

  it('refreshConfigurationCache excludes placeholder primary keys', async () => {
    prismaMock.aiApiKey.findMany.mockResolvedValue([
      {
        encryptedSecret: 'ENC:PLACEHOLDER:v1:not-a-real-api-key',
        provider: { providerKey: 'openai' },
      },
      {
        encryptedSecret: 'v1:abc:def:ghi',
        provider: { providerKey: 'anthropic' },
      },
    ]);

    await service.refreshConfigurationCache();
    expect(service.isProviderConfigured('openai')).toBe(false);
    expect(service.isProviderConfigured('anthropic')).toBe(true);
  });

  it('listKeys marks placeholder rows', async () => {
    prismaMock.aiApiKey.findMany.mockResolvedValue([
      {
        id: 'key-1',
        scopeKey: 'platform',
        tenantId: null,
        branchId: null,
        providerId: 'prov-1',
        name: 'default',
        status: AiApiKeyStatus.ACTIVE,
        encryptedSecret: 'ENC:PLACEHOLDER:v1:not-a-real-api-key',
        encryptionKeyId: 'seed:v1',
        encryptionAlgorithm: 'aes-256-gcm',
        secretHint: '****seed',
        isPrimary: true,
        expiresAt: null,
        rotatedAt: null,
        revokedAt: null,
        lastUsedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        provider: { providerKey: 'openai' },
      },
    ]);

    const rows = await service.listKeys();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.isPlaceholder).toBe(true);
  });
});
