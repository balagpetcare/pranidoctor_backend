import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AiApiKeyStatus } from '../../../generated/prisma/index.js';

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => prismaMock,
}));

vi.mock('../../../shared/security/audit/audit.service.js', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('../governance/ai-governance.service.js', () => ({
  getAiGovernanceService: () => ({
    isProviderDisabled: vi.fn().mockReturnValue(false),
  }),
}));

vi.mock('../vault/encryption.service.js', () => ({
  getEncryptionService: () => ({
    isMasterKeyConfigured: () => true,
  }),
}));

vi.mock('../vault/ai-secret.service.js', () => ({
  getAiSecretService: () => ({
    refreshConfigurationCache: vi.fn(),
    testKey: vi.fn(),
  }),
}));

vi.mock('../../../shared/config/config.loader.js', () => ({
  getConfig: () => ({ nodeEnv: 'test' }),
}));

vi.mock('./ai-registry-admin.service.js', () => ({
  getAiRegistryAdminService: () => ({
    createProvider: vi.fn().mockResolvedValue({ id: 'p1', providerKey: 'openai' }),
    updateProvider: vi.fn(),
  }),
}));

const prismaMock = {
  aiProvider: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  aiApiKey: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('AiProviderManagementService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAiProviderManagementServiceForTests } = await import('./ai-provider-management.service.js');
    resetAiProviderManagementServiceForTests();
  });

  it('computes UNCONFIGURED when no keys', async () => {
    prismaMock.aiProvider.findMany.mockResolvedValue([
      {
        id: 'p1',
        scopeKey: 'platform',
        providerKey: 'openai',
        displayName: 'OpenAI',
        description: null,
        enabled: true,
        priority: 10,
        adapterType: 'openai_native',
        baseUrl: 'https://api.openai.com/v1',
        costTier: 'standard',
        healthScore: 1,
        lastHealthCheckAt: null,
        lastConnectionTestAt: null,
        lastConnectionTestOk: null,
        capabilitiesJson: [],
        configJson: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { models: 1, apiKeys: 0 },
      },
    ]);
    prismaMock.aiApiKey.findMany.mockResolvedValue([]);

    const { getAiProviderManagementService } = await import('./ai-provider-management.service.js');
    const rows = await getAiProviderManagementService().listProviders();
    expect(rows[0]?.effectiveStatus).toBe('UNCONFIGURED');
  });

  it('blocks enable without connection test', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'p1',
      scopeKey: 'platform',
      providerKey: 'openai',
      enabled: false,
      lastConnectionTestAt: null,
      lastConnectionTestOk: null,
    });
    prismaMock.aiApiKey.findMany.mockResolvedValue([
      {
        id: 'k1',
        providerId: 'p1',
        scopeKey: 'platform',
        status: AiApiKeyStatus.ACTIVE,
        isPrimary: true,
        secretHint: '****abcd',
        expiresAt: null,
        deletedAt: null,
      },
    ]);

    const { getAiProviderManagementService } = await import('./ai-provider-management.service.js');
    await expect(
      getAiProviderManagementService().enableProvider('p1', { id: 'admin', role: 'SUPER_ADMIN' }),
    ).rejects.toThrow(/connection test/i);
  });
});
