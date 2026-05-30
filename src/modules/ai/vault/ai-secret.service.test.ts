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
  },
  aiProvider: {
    findFirst: vi.fn(),
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
    prismaMock.aiApiKey.create.mockResolvedValue({
      id: 'key-1',
      scopeKey: 'platform',
      tenantId: null,
      branchId: null,
      providerId: 'prov-1',
      name: 'default',
      status: AiApiKeyStatus.ACTIVE,
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
    expect(result.secretHint).toBe('****cdef');
    expect(prismaMock.aiApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
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
});
