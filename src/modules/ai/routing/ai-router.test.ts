import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeAiTaskType,
  toPascalAiTaskType,
  modalityForTask,
  isSupportedAiTaskType,
} from './ai-task.types.js';
import { parseProviderChainJson } from './provider-chain.util.js';
import { scopeKeysForResolution } from './scope.util.js';
import { RouteResolver, resetRouteResolverForTests } from './route-resolver.js';
import { ModelSelector, resetModelSelectorForTests } from './model-selector.js';
import {
  AIRouterService,
  resetAIRouterServiceForTests,
} from './ai-router.service.js';
import { AiRouteNotFoundError, AiModelNotFoundError } from './ai-router.errors.js';

const aiRouteFindFirst = vi.fn();
const aiProviderFindFirst = vi.fn();
const aiModelFindFirst = vi.fn();

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiRoute: { findFirst: aiRouteFindFirst },
    aiProvider: { findFirst: aiProviderFindFirst },
    aiModel: { findFirst: aiModelFindFirst },
  }),
}));

vi.mock('../../../shared/monitoring/structured-logging.js', () => ({
  logAiExecution: vi.fn(),
}));

function resetRoutingForTests(): void {
  resetAIRouterServiceForTests();
  resetRouteResolverForTests();
  resetModelSelectorForTests();
  aiRouteFindFirst.mockReset();
  aiProviderFindFirst.mockReset();
  aiModelFindFirst.mockReset();
}

const platformGeneralChatRoute = {
  id: 'route-1',
  scopeKey: 'platform',
  routeKey: 'general_chat',
  name: 'General Chat',
  taskType: 'GENERAL_CHAT',
  enabled: true,
  priority: 10,
  maxRetries: 2,
  timeoutMs: 30000,
  asyncRequired: false,
  maxCostUsd: { toString: () => '0.002' },
  fallbackToRules: true,
  primaryProviderId: 'prov-openai',
  primaryModelId: 'model-mini',
  providerChainJson: [
    { order: 0, providerKey: 'openai', providerId: 'prov-openai', modelId: 'model-mini' },
    { order: 1, providerKey: 'anthropic', providerId: 'prov-anthropic', modelId: 'model-haiku' },
    { order: 2, providerKey: 'rules-based', providerId: 'prov-rules', modelId: 'model-rules' },
  ],
  primaryProvider: {
    id: 'prov-openai',
    providerKey: 'openai',
    enabled: true,
    adapterType: 'openai_native',
  },
};

const tenantImageRoute = {
  ...platformGeneralChatRoute,
  id: 'route-tenant-image',
  scopeKey: 'tenant:t1',
  routeKey: 'image_analysis_tenant',
  name: 'Tenant Image Analysis',
  taskType: 'IMAGE_ANALYSIS',
  primaryModelId: 'model-vision',
  providerChainJson: [
    { order: 0, providerKey: 'gemini', providerId: 'prov-gemini', modelId: 'model-vision' },
  ],
};

describe('ai-task.types', () => {
  it('normalizes PascalCase and SCREAMING_SNAKE task types', () => {
    expect(normalizeAiTaskType('GeneralChat')).toBe('GENERAL_CHAT');
    expect(normalizeAiTaskType('GENERAL_CHAT')).toBe('GENERAL_CHAT');
    expect(normalizeAiTaskType('image_analysis')).toBe('IMAGE_ANALYSIS');
  });

  it('converts DB task type to PascalCase', () => {
    expect(toPascalAiTaskType('EMERGENCY_CONSULTATION')).toBe('EmergencyConsultation');
  });

  it('maps modalities by task', () => {
    expect(modalityForTask('IMAGE_ANALYSIS')).toBe('vision');
    expect(modalityForTask('GENERAL_CHAT')).toBe('chat');
  });

  it('validates supported task types', () => {
    expect(isSupportedAiTaskType('FeedFormulation')).toBe(true);
    expect(isSupportedAiTaskType('UnknownTask')).toBe(false);
  });
});

describe('provider-chain.util', () => {
  it('parses and sorts provider chain entries', () => {
    const chain = parseProviderChainJson([
      { order: 2, providerKey: 'rules-based', providerId: 'p3', modelId: null },
      { order: 0, providerKey: 'openai', providerId: 'p1', modelId: 'm1' },
    ]);
    expect(chain.map((c) => c.providerKey)).toEqual(['openai', 'rules-based']);
  });
});

describe('scope.util', () => {
  it('orders scope keys branch → tenant → platform', () => {
    expect(scopeKeysForResolution('t1', 'b1')).toEqual([
      'tenant:t1:branch:b1',
      'tenant:t1',
      'platform',
    ]);
  });
});

describe('RouteResolver', () => {
  afterEach(resetRoutingForTests);

  it('loads route from platform scope', async () => {
    aiRouteFindFirst.mockResolvedValueOnce(platformGeneralChatRoute);

    const resolver = new RouteResolver();
    const { row, scopeKey } = await resolver.findRouteRow({ taskType: 'GeneralChat' });

    expect(scopeKey).toBe('platform');
    expect(row.routeKey).toBe('general_chat');
    expect(aiRouteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scopeKey: 'platform', taskType: 'GENERAL_CHAT' }),
      }),
    );
  });

  it('prefers tenant scope over platform', async () => {
    aiRouteFindFirst.mockImplementation(({ where }: { where: { scopeKey: string } }) => {
      if (where.scopeKey === 'tenant:t1') return Promise.resolve(tenantImageRoute);
      return Promise.resolve(null);
    });

    const resolver = new RouteResolver();
    const { row, scopeKey } = await resolver.findRouteRow({
      taskType: 'ImageAnalysis',
      tenantId: 't1',
    });

    expect(scopeKey).toBe('tenant:t1');
    expect(row.taskType).toBe('IMAGE_ANALYSIS');
  });

  it('throws when no route exists', async () => {
    aiRouteFindFirst.mockResolvedValue(null);
    const resolver = new RouteResolver();
    await expect(resolver.findRouteRow({ taskType: 'VideoAnalysis' })).rejects.toBeInstanceOf(
      AiRouteNotFoundError,
    );
  });
});

describe('ModelSelector', () => {
  afterEach(resetRoutingForTests);

  it('uses admin-selected primary model when provider matches', async () => {
    aiModelFindFirst.mockResolvedValueOnce({
      id: 'model-mini',
      modelKey: 'gpt-4o-mini',
      modelType: 'chat',
      providerId: 'prov-openai',
      enabled: true,
    });

    const selector = new ModelSelector();
    const selected = await selector.select({
      scopeKey: 'platform',
      providerId: 'prov-openai',
      providerKey: 'openai',
      routePrimaryModelId: 'model-mini',
      chainModelId: 'model-other',
    });

    expect(selected.modelKey).toBe('gpt-4o-mini');
    expect(aiModelFindFirst).toHaveBeenCalledTimes(1);
  });

  it('uses chain model id when primary model provider differs', async () => {
    aiModelFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'model-haiku',
      modelKey: 'claude-3-5-haiku-20241022',
      modelType: 'chat',
      providerId: 'prov-anthropic',
      enabled: true,
    });

    const selector = new ModelSelector();
    const selected = await selector.select({
      scopeKey: 'platform',
      providerId: 'prov-anthropic',
      providerKey: 'anthropic',
      routePrimaryModelId: 'model-mini',
      chainModelId: 'model-haiku',
    });

    expect(selected.modelKey).toBe('claude-3-5-haiku-20241022');
  });

  it('falls back to default model from database', async () => {
    aiModelFindFirst.mockResolvedValueOnce({
      id: 'model-default',
      modelKey: 'deepseek-chat',
      modelType: 'chat',
      providerId: 'prov-deepseek',
      enabled: true,
    });

    const selector = new ModelSelector();
    const selected = await selector.select({
      scopeKey: 'platform',
      providerId: 'prov-deepseek',
      providerKey: 'deepseek',
    });

    expect(selected.modelKey).toBe('deepseek-chat');
  });

  it('throws when no model exists for provider', async () => {
    aiModelFindFirst.mockResolvedValue(null);
    const selector = new ModelSelector();
    await expect(
      selector.select({
        scopeKey: 'platform',
        providerId: 'prov-x',
        providerKey: 'unknown',
      }),
    ).rejects.toBeInstanceOf(AiModelNotFoundError);
  });
});

describe('AIRouterService', () => {
  afterEach(resetRoutingForTests);

  beforeEach(() => {
    aiRouteFindFirst.mockResolvedValue(platformGeneralChatRoute);
  });

  function mockProvider(key: string, id: string) {
    return {
      id,
      providerKey: key,
      enabled: true,
      adapterType: key === 'openai' ? 'openai_native' : key === 'anthropic' ? 'anthropic_native' : 'internal_rules',
    };
  }

  function mockModel(id: string, key: string, providerId: string) {
    return {
      id,
      modelKey: key,
      modelType: key.includes('rules') ? 'rules' : 'chat',
      providerId,
      enabled: true,
    };
  }

  it('resolves full hop chain with models from database', async () => {
    aiProviderFindFirst
      .mockResolvedValueOnce(mockProvider('openai', 'prov-openai'))
      .mockResolvedValueOnce(mockProvider('anthropic', 'prov-anthropic'))
      .mockResolvedValueOnce(mockProvider('rules-based', 'prov-rules'));

    aiModelFindFirst
      .mockResolvedValueOnce(mockModel('model-mini', 'gpt-4o-mini', 'prov-openai'))
      .mockResolvedValueOnce(mockModel('model-haiku', 'claude-3-5-haiku-20241022', 'prov-anthropic'))
      .mockResolvedValueOnce(mockModel('model-rules', 'rules-based-v1', 'prov-rules'));

    const router = new AIRouterService();
    const route = await router.resolve({ taskType: 'GeneralChat' });

    expect(route.routeKey).toBe('general_chat');
    expect(route.hops).toHaveLength(3);
    expect(route.hops[0]).toMatchObject({
      providerKey: 'openai',
      modelKey: 'gpt-4o-mini',
    });
    expect(route.hops[1]).toMatchObject({
      providerKey: 'anthropic',
      modelKey: 'claude-3-5-haiku-20241022',
    });
    expect(route.hops[2]).toMatchObject({
      providerKey: 'rules-based',
      modelKey: 'rules-based-v1',
    });
  });

  it('resolvePrimary returns first hop only', async () => {
    aiProviderFindFirst.mockResolvedValueOnce(mockProvider('openai', 'prov-openai'));
    aiModelFindFirst.mockResolvedValueOnce(mockModel('model-mini', 'gpt-4o-mini', 'prov-openai'));

    const router = new AIRouterService();
    const hop = await router.resolvePrimary({ taskType: 'DiseaseAnalysis' });

    expect(hop.providerKey).toBe('openai');
    expect(hop.modelKey).toBe('gpt-4o-mini');
  });

  it('reports execution modality from task type', () => {
    const router = new AIRouterService();
    expect(router.executionModalityFor({ taskType: 'ImageAnalysis' })).toBe('vision');
    expect(router.executionModalityFor({ taskType: 'PrescriptionAnalysis' })).toBe('chat');
  });

  it('does not embed hardcoded model names in service code', async () => {
    aiProviderFindFirst.mockResolvedValueOnce(mockProvider('openai', 'prov-openai'));
    aiModelFindFirst.mockResolvedValueOnce(
      mockModel('model-custom', 'admin-selected-model-v2', 'prov-openai'),
    );

    const router = new AIRouterService();
    const route = await router.resolve({ taskType: 'FeedFormulation' });

    expect(route.hops[0]?.modelKey).toBe('admin-selected-model-v2');
  });
});
