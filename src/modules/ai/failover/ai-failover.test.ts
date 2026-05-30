import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from './circuit-breaker.js';
import { FailoverRuleResolver } from './failover-rule.resolver.js';
import {
  classifyExecutionError,
  isRetriableError,
  mapErrorToFailoverTrigger,
  retryDelayMs,
  withTimeout,
} from './failover.util.js';
import { AIProviderMonitor, getAIProviderMonitor, resetAIProviderMonitorForTests } from './ai-provider-monitor.js';
import { AIHealthService, resetAIHealthServiceForTests } from './ai-health.service.js';
import {
  AIFailoverService,
  resetAIFailoverServiceForTests,
} from './ai-failover.service.js';
import { AiFailoverExhaustedError, AiFailoverAbortedError } from './failover.errors.js';
import type { ResolvedRoute, RouteHop } from '../routing/ai-router.types.js';
import { resetAIRouterServiceForTests } from '../routing/ai-router.service.js';

const aiFailoverRuleFindMany = vi.fn();
const aiProviderUpdateMany = vi.fn();
const healthCheckMock = vi.fn();
const isProviderConfiguredMock = vi.fn();

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiFailoverRule: { findMany: aiFailoverRuleFindMany },
    aiProvider: { updateMany: aiProviderUpdateMany },
  }),
}));

vi.mock('../../../shared/monitoring/structured-logging.js', () => ({
  logAiExecution: vi.fn(),
}));

vi.mock('../usage/ai-usage.metrics.js', () => ({
  setProviderUpMetric: vi.fn(),
  recordProviderHealthMetric: vi.fn(),
}));

const resolveRouteMock = vi.fn();

vi.mock('../routing/ai-router.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routing/ai-router.service.js')>();
  return {
    ...actual,
    getAIRouterService: () => ({
      resolve: resolveRouteMock,
    }),
  };
});

vi.mock('../providers/index.js', () => ({
  ensureAiProvidersBootstrapped: vi.fn(),
  getAiProviderRegistry: () => ({
    get: (key: string) =>
      key === 'openai'
        ? {
            key: 'openai',
            healthCheck: healthCheckMock,
            isConfigured: isProviderConfiguredMock,
          }
        : undefined,
    list: () => [{ key: 'openai' }],
  }),
}));

function hop(
  order: number,
  providerKey: string,
  modelKey: string,
  providerId?: string,
): RouteHop {
  return {
    order,
    providerId: providerId ?? `prov-${providerKey}`,
    providerKey,
    modelId: `model-${providerKey}`,
    modelKey,
    modelType: providerKey === 'rules-based' ? 'rules' : 'chat',
    adapterType: 'openai_native',
    providerEnabled: true,
    modelEnabled: true,
  };
}

function mockRoute(overrides?: Partial<ResolvedRoute>): ResolvedRoute {
  return {
    routeId: 'route-1',
    routeKey: 'general_chat',
    taskType: 'GENERAL_CHAT',
    scopeKey: 'platform',
    name: 'General Chat',
    maxRetries: 1,
    timeoutMs: 500,
    asyncRequired: false,
    maxCostUsd: 0.002,
    fallbackToRules: true,
    hops: [
      hop(0, 'openai', 'gpt-4o-mini', 'prov-openai'),
      hop(1, 'anthropic', 'claude-3-5-haiku-20241022', 'prov-anthropic'),
      hop(2, 'deepseek', 'deepseek-chat', 'prov-deepseek'),
      hop(3, 'rules-based', 'rules-based-v1', 'prov-rules'),
    ],
    ...overrides,
  };
}

function resetFailoverForTests(): void {
  resetAIFailoverServiceForTests();
  resetAIHealthServiceForTests();
  resetAIProviderMonitorForTests();
  resetAIRouterServiceForTests();
  aiFailoverRuleFindMany.mockReset();
  aiProviderUpdateMany.mockReset();
  healthCheckMock.mockReset();
  isProviderConfiguredMock.mockReset();
  resolveRouteMock.mockReset();
}

describe('failover.util', () => {
  it('maps error codes to DB failover triggers', () => {
    expect(mapErrorToFailoverTrigger('rate_limit')).toBe('HTTP_429');
    expect(mapErrorToFailoverTrigger('provider_5xx', 503)).toBe('HTTP_5XX');
    expect(mapErrorToFailoverTrigger('timeout')).toBe('TIMEOUT');
  });

  it('classifies execution errors', () => {
    expect(classifyExecutionError(new Error('OpenAI error 503: unavailable')).errorCode).toBe(
      'provider_5xx',
    );
  });

  it('computes exponential retry delay', () => {
    expect(retryDelayMs(0)).toBe(250);
    expect(retryDelayMs(3)).toBe(2000);
  });

  it('times out long-running promises', async () => {
    await expect(
      withTimeout(new Promise<string>(() => undefined), 20, 'slow'),
    ).rejects.toThrow('timeout after 20ms');
  });
});

describe('CircuitBreaker', () => {
  it('opens after failure threshold and blocks requests', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 1,
    });

    breaker.recordFailure('openai');
    breaker.recordFailure('openai');
    expect(breaker.allowRequest('openai')).toBe(true);

    breaker.recordFailure('openai');
    expect(breaker.getState('openai')).toBe('open');
    expect(breaker.allowRequest('openai')).toBe(false);
  });

  it('transitions to half-open after reset timeout', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100,
      halfOpenSuccessThreshold: 1,
    });

    breaker.recordFailure('anthropic', 1000);
    expect(breaker.allowRequest('anthropic', 1101)).toBe(true);
    expect(breaker.getState('anthropic')).toBe('half_open');
  });

  it('closes after successful half-open probe', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 100,
      halfOpenSuccessThreshold: 1,
    });

    breaker.recordFailure('openai', 0);
    breaker.allowRequest('openai', 200);
    breaker.recordSuccess('openai');
    expect(breaker.getState('openai')).toBe('closed');
  });
});

describe('FailoverRuleResolver', () => {
  const resolver = new FailoverRuleResolver();

  it('retries on rate limit when rule says RETRY_SAME', () => {
    const decision = resolver.resolve({
      rules: [
        {
          id: 'r1',
          routeId: 'route-1',
          triggerType: 'HTTP_429',
          action: 'RETRY_SAME',
          priority: 10,
          fromProviderId: 'prov-openai',
          toProviderId: null,
          enabled: true,
        },
      ],
      errorCode: 'rate_limit',
      fromProviderId: 'prov-openai',
      retriesRemaining: 1,
    });
    expect(decision).toBe('retry');
  });

  it('advances provider on HTTP 5xx rule', () => {
    const decision = resolver.resolve({
      rules: [
        {
          id: 'r1',
          routeId: 'route-1',
          triggerType: 'HTTP_5XX',
          action: 'NEXT_PROVIDER',
          priority: 10,
          fromProviderId: 'prov-openai',
          toProviderId: 'prov-anthropic',
          enabled: true,
        },
      ],
      errorCode: 'provider_5xx',
      statusCode: 503,
      fromProviderId: 'prov-openai',
      retriesRemaining: 0,
    });
    expect(decision).toBe('next');
  });

  it('defaults to retry for retriable errors without rules', () => {
    expect(
      resolver.resolve({
        rules: [],
        errorCode: 'timeout',
        fromProviderId: 'prov-openai',
        retriesRemaining: 1,
      }),
    ).toBe('retry');
    expect(isRetriableError('timeout')).toBe(true);
  });
});

describe('AIProviderMonitor', () => {
  afterEach(resetFailoverForTests);

  it('records success and failure snapshots', () => {
    const monitor = new AIProviderMonitor({
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      halfOpenSuccessThreshold: 1,
    });

    monitor.recordSuccess('openai', 120);
    expect(monitor.getSnapshot('openai')?.reachable).toBe(true);

    monitor.recordFailure('openai', 80, 'provider_5xx');
    expect(monitor.getSnapshot('openai')?.reachable).toBe(false);
    expect(monitor.getConsecutiveFailures('openai')).toBe(1);
  });

  it('blocks provider when circuit is open', () => {
    const monitor = new AIProviderMonitor({
      failureThreshold: 1,
      resetTimeoutMs: 60_000,
      halfOpenSuccessThreshold: 1,
    });

    monitor.recordFailure('openai', 10, 'timeout');
    expect(monitor.shouldAllowProvider('openai')).toBe(false);
  });
});

describe('AIHealthService', () => {
  afterEach(resetFailoverForTests);

  it('probes registered provider via healthCheck', async () => {
    healthCheckMock.mockResolvedValue({
      provider: 'openai',
      configured: true,
      reachable: true,
      latencyMs: 45,
      capabilities: { chat: true, vision: true, embeddings: true },
    });
    isProviderConfiguredMock.mockReturnValue(true);
    aiProviderUpdateMany.mockResolvedValue({ count: 1 });

    const health = new AIHealthService();
    const snapshot = await health.checkProvider('openai');

    expect(snapshot.reachable).toBe(true);
    expect(snapshot.providerKey).toBe('openai');
    expect(aiProviderUpdateMany).toHaveBeenCalled();
  });

  it('treats rules-based provider as always healthy', async () => {
    const health = new AIHealthService();
    const snapshot = await health.checkProvider('rules-based');
    expect(snapshot.reachable).toBe(true);
  });
});

describe('AIFailoverService', () => {
  afterEach(resetFailoverForTests);

  beforeEach(() => {
    aiFailoverRuleFindMany.mockResolvedValue([]);
    resolveRouteMock.mockResolvedValue(mockRoute());
  });

  it('executes on primary provider when successful', async () => {
    const service = new AIFailoverService();
    const execution = await service.execute(
      { taskType: 'GeneralChat', feature: 'CHAT' },
      async (ctx) => `ok:${ctx.hop.providerKey}`,
    );

    expect(execution.tier).toBe('primary');
    expect(execution.usedHop.providerKey).toBe('openai');
    expect(execution.result).toBe('ok:openai');
    expect(execution.isFallback).toBe(false);
  });

  it('falls back from primary to secondary to tertiary', async () => {
    resolveRouteMock.mockResolvedValue(mockRoute({ maxRetries: 0 }));
    const service = new AIFailoverService();
    const seen: string[] = [];

    const execution = await service.execute(
      { taskType: 'GeneralChat', feature: 'CHAT' },
      async (ctx) => {
        seen.push(ctx.hop.providerKey);
        if (ctx.hop.providerKey !== 'deepseek') {
          throw new Error('Anthropic error 503: unavailable');
        }
        return 'tertiary-ok';
      },
    );

    expect(seen).toEqual(['openai', 'anthropic', 'deepseek']);
    expect(execution.tier).toBe('tertiary');
    expect(execution.usedHop.providerKey).toBe('deepseek');
    expect(execution.isFallback).toBe(true);
  });

  it('retries primary before failing over', async () => {
    resolveRouteMock.mockResolvedValue(mockRoute({ maxRetries: 2, timeoutMs: 2000 }));
    const service = new AIFailoverService();
    let openaiAttempts = 0;

    await expect(
      service.execute({ taskType: 'GeneralChat', feature: 'CHAT' }, async (ctx) => {
        if (ctx.hop.providerKey === 'openai') {
          openaiAttempts += 1;
          throw new Error('ETIMEDOUT');
        }
        return 'anthropic-ok';
      }),
    ).resolves.toMatchObject({
      usedHop: { providerKey: 'anthropic' },
    });

    expect(openaiAttempts).toBe(3);
  });

  it('skips provider when circuit is open', async () => {
    process.env.AI_CIRCUIT_FAILURE_THRESHOLD = '1';
    resetAIProviderMonitorForTests();
    const monitor = getAIProviderMonitor();
    monitor.recordFailure('openai', 10, 'provider_5xx');

    const service = new AIFailoverService();
    const seen: string[] = [];

    const execution = await service.execute(
      { taskType: 'GeneralChat', feature: 'CHAT' },
      async (ctx) => {
        seen.push(ctx.hop.providerKey);
        if (ctx.hop.providerKey === 'anthropic') return 'secondary-ok';
        throw new Error('should not run');
      },
    );

    expect(seen[0]).toBe('anthropic');
    expect(execution.tier).toBe('secondary');
  });

  it('jumps to rules-based when DB rule says RULES_ONLY', async () => {
    aiFailoverRuleFindMany.mockResolvedValue([
      {
        id: 'rule-budget',
        routeId: 'route-1',
        triggerType: 'BUDGET_EXCEEDED',
        action: 'RULES_ONLY',
        priority: 5,
        fromProviderId: null,
        toProviderId: null,
        enabled: true,
      },
    ]);

    const service = new AIFailoverService();
    const execution = await service.execute(
      { taskType: 'GeneralChat', feature: 'CHAT' },
      async (ctx) => {
        if (ctx.hop.providerKey === 'openai') {
          throw new Error('budget exceeded');
        }
        return `ok:${ctx.hop.providerKey}`;
      },
    );

    expect(execution.usedHop.providerKey).toBe('rules-based');
    expect(execution.isFallback).toBe(true);
  });

  it('throws when all providers are exhausted', async () => {
    const service = new AIFailoverService();
    await expect(
      service.execute({ taskType: 'GeneralChat', feature: 'CHAT' }, async () => {
        throw new Error('OpenAI error 503: down');
      }),
    ).rejects.toBeInstanceOf(AiFailoverExhaustedError);
  });

  it('aborts when rule action is ABORT', async () => {
    aiFailoverRuleFindMany.mockResolvedValue([
      {
        id: 'rule-abort',
        routeId: 'route-1',
        triggerType: 'HTTP_5XX',
        action: 'ABORT',
        priority: 1,
        fromProviderId: 'prov-openai',
        toProviderId: null,
        enabled: true,
      },
    ]);

    const service = new AIFailoverService();
    await expect(
      service.execute({ taskType: 'GeneralChat', feature: 'CHAT' }, async () => {
        throw new Error('OpenAI error 503: down');
      }),
    ).rejects.toBeInstanceOf(AiFailoverAbortedError);
  });

  it('exposes primary, secondary, tertiary hops from resolved route', () => {
    const service = new AIFailoverService();
    const tiers = service.getPrimarySecondaryTertiary(mockRoute());

    expect(tiers.primary?.providerKey).toBe('openai');
    expect(tiers.secondary?.providerKey).toBe('anthropic');
    expect(tiers.tertiary?.providerKey).toBe('deepseek');
  });
});
