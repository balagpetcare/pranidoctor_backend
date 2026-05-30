import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiApiKeyAuditAction, AiApiKeyStatus } from '../../../generated/prisma/index.js';
import { KeyRotationService, resetKeyRotationServiceForTests } from './key-rotation.service.js';
import { resetAiSecretServiceForTests } from './ai-secret.service.js';
import { resetEncryptionServiceForTests } from './encryption.service.js';

const prismaMock = {
  aiApiKey: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  aiApiKeyAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

describe('KeyRotationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetKeyRotationServiceForTests();
    resetAiSecretServiceForTests();
    resetEncryptionServiceForTests();
    process.env.AI_VAULT_MASTER_KEY = Buffer.alloc(32, 9).toString('base64');
  });

  it('rotates key: marks old ROTATED and creates new ACTIVE', async () => {
    const service = new KeyRotationService();

    prismaMock.aiApiKey.findFirst.mockResolvedValue({
      id: 'old-key',
      scopeKey: 'platform',
      tenantId: null,
      branchId: null,
      providerId: 'prov-1',
      name: 'default',
      expiresAt: null,
      version: 1,
      provider: { providerKey: 'openai' },
    });

    prismaMock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    prismaMock.aiApiKey.update.mockResolvedValue({ id: 'old-key' });
    prismaMock.aiApiKey.create.mockResolvedValue({ id: 'new-key' });
    prismaMock.aiApiKeyAuditLog.create.mockResolvedValue({});
    prismaMock.aiApiKey.findMany.mockResolvedValue([{ provider: { providerKey: 'openai' } }]);

    const result = await service.rotateKey(
      'old-key',
      'sk-test-openai-key-rotated123456',
      { userId: 'admin-1', role: 'SUPER_ADMIN' },
      'scheduled rotation',
    );

    expect(result.previousKeyId).toBe('old-key');
    expect(result.newKeyId).toBe('new-key');
    expect(prismaMock.aiApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AiApiKeyStatus.ROTATED }),
      }),
    );
    expect(prismaMock.aiApiKeyAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AiApiKeyAuditAction.ROTATED }),
      }),
    );
  });
});
