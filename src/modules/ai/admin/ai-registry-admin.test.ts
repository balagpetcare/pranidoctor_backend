import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AiRegistryAdminService,
  resetAiRegistryAdminServiceForTests,
} from './ai-registry-admin.service.js';
import { createProviderSchema, toggleEnabledSchema } from './ai-admin.schemas.js';

const aiProviderFindMany = vi.fn();
const aiProviderFindFirst = vi.fn();
const aiProviderCreate = vi.fn();
const aiProviderUpdate = vi.fn();

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiProvider: {
      findMany: aiProviderFindMany,
      findFirst: aiProviderFindFirst,
      create: aiProviderCreate,
      update: aiProviderUpdate,
    },
    aiModel: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiRoute: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiFailoverRule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  }),
}));

vi.mock('../platform/ai-platform-admin.service.js', () => ({
  getAiPlatformAdminService: () => ({
    getProvidersDashboard: vi.fn().mockResolvedValue({ health: [], metrics: [] }),
    getHealthDashboard: vi.fn().mockResolvedValue({ providers: [], validations: [] }),
  }),
}));

const providerRow = {
  id: 'prov-1',
  scopeKey: 'platform',
  tenantId: null,
  branchId: null,
  providerKey: 'openai',
  displayName: 'OpenAI',
  description: null,
  enabled: true,
  priority: 100,
  adapterType: 'openai_compatible',
  baseUrl: null,
  capabilitiesJson: [],
  configJson: null,
  healthScore: 1,
  lastHealthCheckAt: null,
  costTier: 'standard',
  version: 1,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  _count: { models: 2, apiKeys: 1 },
};

function reset(): void {
  resetAiRegistryAdminServiceForTests();
  aiProviderFindMany.mockReset();
  aiProviderFindFirst.mockReset();
  aiProviderCreate.mockReset();
  aiProviderUpdate.mockReset();
}

describe('ai-admin.schemas', () => {
  it('validates provider create input', () => {
    const parsed = createProviderSchema.parse({
      providerKey: 'openai',
      displayName: 'OpenAI',
    });
    expect(parsed.providerKey).toBe('openai');
  });

  it('rejects invalid provider keys', () => {
    expect(() => createProviderSchema.parse({ providerKey: 'Bad Key', displayName: 'X' })).toThrow();
  });

  it('validates toggle payload', () => {
    expect(toggleEnabledSchema.parse({ enabled: false }).enabled).toBe(false);
  });
});

describe('AiRegistryAdminService', () => {
  afterEach(reset);

  it('lists providers with counts', async () => {
    aiProviderFindMany.mockResolvedValueOnce([providerRow]);
    const service = new AiRegistryAdminService();
    const rows = await service.listProviders();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.modelCount).toBe(2);
    expect(rows[0]?.providerKey).toBe('openai');
  });

  it('creates a provider when key is unique', async () => {
    aiProviderFindFirst.mockResolvedValueOnce(null);
    aiProviderCreate.mockResolvedValueOnce(providerRow);
    const service = new AiRegistryAdminService();
    const created = await service.createProvider(
      { providerKey: 'openai', displayName: 'OpenAI' },
      'admin-1',
    );
    expect(created.providerKey).toBe('openai');
  });

  it('rejects duplicate provider keys', async () => {
    aiProviderFindFirst.mockResolvedValueOnce(providerRow);
    const service = new AiRegistryAdminService();
    await expect(
      service.createProvider({ providerKey: 'openai', displayName: 'OpenAI' }),
    ).rejects.toThrow(/already exists/);
  });

  it('toggles provider enabled flag', async () => {
    aiProviderFindFirst.mockResolvedValueOnce(providerRow);
    aiProviderUpdate.mockResolvedValueOnce({ ...providerRow, enabled: false });
    const service = new AiRegistryAdminService();
    const updated = await service.toggleProvider('prov-1', false, 'admin-1');
    expect(updated.enabled).toBe(false);
  });
});
