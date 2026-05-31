import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModelInvocationAdapter, resetModelInvocationAdapterForTests } from './adapters/model-invocation.adapter.js';
import {
  ProviderAdapterFactory,
  resetProviderAdapterFactoryForTests,
} from './adapters/provider-adapter.factory.js';
import { FallbackEngine, resetFallbackEngineForTests } from './engines/fallback.engine.js';
import { RetryEngine, resetRetryEngineForTests } from './engines/retry.engine.js';
import { TimeoutEngine, resetTimeoutEngineForTests } from './engines/timeout.engine.js';
import { CostGateEngine, resetCostGateEngineForTests } from './engines/cost-gate.engine.js';
import { RouterHealthMonitor, resetRouterHealthMonitorForTests } from './engines/health-monitor.service.js';
import {
  AiRouterEngine,
  resetAiRouterEngineForTests,
} from './ai-router-engine.service.js';
import { resetAIRouterServiceForTests } from '../routing/ai-router.service.js';
import type { RouteHop } from '../routing/ai-router.types.js';

const aiFailoverRuleFindMany = vi.fn();
const resolveRouteMock = vi.fn();

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiFailoverRule: { findMany: aiFailoverRuleFindMany },
  }),
}));

vi.mock('../../../shared/monitoring/structured-logging.js', () => ({
  logAiExecution: vi.fn(),
}));

const estimateCostUsdMock = vi.fn();

vi.mock('../usage/ai-cost-rate.service.js', () => ({
  getAiCostRateService: () => ({
    estimateCostUsd: estimateCostUsdMock,
  }),
}));

vi.mock('../usage/ai-usage.metrics.js', () => ({
  setProviderUpMetric: vi.fn(),
  recordProviderHealthMetric: vi.fn(),
}));

vi.mock('../routing/ai-router.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routing/ai-router.service.js')>();
  return {
    ...actual,
    getAIRouterService: () => ({
      resolve: resolveRouteMock,
    }),
  };
});

function hop(providerKey: string, modelKey: string, order: number): RouteHop {
  return {
    order,
    providerId: `prov-${providerKey}`,
    providerKey,
    modelId: `model-${providerKey}`,
    modelKey,
    modelType: 'chat',
    adapterType: 'openai_compatible',
    providerEnabled: true,
    modelEnabled: true,
  };
}

function resetAll(): void {
  resetAiRouterEngineForTests();
  resetAIRouterServiceForTests();
  resetTimeoutEngineForTests();
  resetRetryEngineForTests();
  resetFallbackEngineForTests();
  resetRouterHealthMonitorForTests();
  resetProviderAdapterFactoryForTests();
  resetModelInvocationAdapterForTests();
  resetCostGateEngineForTests();
  estimateCostUsdMock.mockReset();
  aiFailoverRuleFindMany.mockReset();
  resolveRouteMock.mockReset();
}

describe('router engines', () => {
  afterEach(resetAll);

  it('TimeoutEngine computes remaining hop budget', () => {
    const engine = new TimeoutEngine();
    expect(engine.hopTimeoutMs(30_000, 5_000)).toBe(25_000);
    expect(engine.hopTimeoutMs(30_000, 29_500)).toBeGreaterThanOrEqual(1_000);
  });

  it('RetryEngine respects retriable errors', () => {
    const engine = new RetryEngine();
    expect(engine.canRetrySameHop('provider_5xx', 1)).toBe(true);
    expect(engine.canRetrySameHop('auth', 1)).toBe(false);
    expect(engine.canRetrySameHop('timeout', 2)).toBe(false);
  });

  it('FallbackEngine maps 429 to next provider when rule exists', () => {
    const engine = new FallbackEngine();
    const decision = engine.decide({
      rules: [
        {
          id: 'r1',
          routeId: 'route-1',
          triggerType: 'HTTP_429',
          action: 'NEXT_PROVIDER',
          priority: 10,
          fromProviderId: null,
          toProviderId: null,
          enabled: true,
        },
      ],
      errorCode: 'rate_limit',
      statusCode: 429,
      fromProviderId: 'p1',
      retriesRemaining: 0,
    });
    expect(decision).toBe('next');
  });
});

describe('ModelInvocationAdapter', () => {
  afterEach(resetAll);

  it('passes resolvedModelKey to provider adapter', async () => {
    const captured: { model?: string } = {};
    const factory = new ProviderAdapterFactory();
    factory.register('openai', () => ({
      name: 'openai',
      isConfigured: () => true,
      complete: async (input) => {
        captured.model = input.resolvedModelKey;
        return {
          content: 'ok',
          confidence: 0.9,
          provider: 'openai',
          model: input.resolvedModelKey ?? 'unknown',
          inputTokens: 1,
          outputTokens: 1,
          latencyMs: 1,
        };
      },
    }));

    const adapter = new ModelInvocationAdapter(factory);
    await adapter.complete(
      {
        feature: 'TEST',
        systemPrompt: 'sys',
        userMessage: 'hi',
        locale: 'en',
      },
      hop('openai', 'gpt-4o-mini', 0),
    );

    expect(captured.model).toBe('gpt-4o-mini');
  });
});

describe('AiRouterEngine', () => {
  afterEach(resetAll);

  it('failovers from openai to gemini on primary failure', async () => {
    aiFailoverRuleFindMany.mockResolvedValueOnce([]);
    resolveRouteMock.mockResolvedValueOnce({
      routeId: 'route-1',
      routeKey: 'platform_general_chat',
      taskType: 'GENERAL_CHAT',
      scopeKey: 'platform',
      name: 'General Chat',
      maxRetries: 0,
      timeoutMs: 2_000,
      asyncRequired: false,
      maxCostUsd: null,
      fallbackToRules: false,
      hops: [hop('openai', 'gpt-4o-mini', 0), hop('gemini', 'gemini-1.5-flash', 1)],
    });

    const calls: string[] = [];
    const engine = new AiRouterEngine();
    const result = await engine.execute(
      { taskType: 'GENERAL_CHAT', feature: 'TEST' },
      async (ctx) => {
        calls.push(ctx.hop.providerKey);
        if (ctx.hop.providerKey === 'openai') throw new Error('provider error 503');
        return { ok: true, provider: ctx.hop.providerKey };
      },
    );

    expect(calls).toEqual(['openai', 'gemini']);
    expect(result.usedHop.providerKey).toBe('gemini');
    expect(result.isFallback).toBe(true);
  });

  it('skips hops with open circuit', async () => {
    aiFailoverRuleFindMany.mockResolvedValueOnce([]);
    resolveRouteMock.mockResolvedValueOnce({
      routeId: 'route-1',
      routeKey: 'test',
      taskType: 'GENERAL_CHAT',
      scopeKey: 'platform',
      name: 'Test',
      maxRetries: 0,
      timeoutMs: 2_000,
      asyncRequired: false,
      maxCostUsd: null,
      fallbackToRules: false,
      hops: [hop('openai', 'gpt-4o-mini', 0), hop('gemini', 'gemini-1.5-flash', 1)],
    });

    const monitor = new RouterHealthMonitor();
    for (let i = 0; i < 6; i += 1) {
      monitor.recordFailure('openai', 10, 'provider_5xx');
    }

    const calls: string[] = [];
    const engine = new AiRouterEngine();
    const result = await engine.execute(
      { taskType: 'GENERAL_CHAT', feature: 'TEST' },
      async (ctx) => {
        calls.push(ctx.hop.providerKey);
        return { ok: true };
      },
    );

    expect(calls).toEqual(['gemini']);
    expect(result.usedHop.providerKey).toBe('gemini');
  });

  it('does not retry same hop on timeout — advances to next provider', async () => {
    aiFailoverRuleFindMany.mockResolvedValueOnce([]);
    resolveRouteMock.mockResolvedValueOnce({
      routeId: 'route-1',
      routeKey: 'test',
      taskType: 'GENERAL_CHAT',
      scopeKey: 'platform',
      name: 'Test',
      maxRetries: 2,
      timeoutMs: 5_000,
      asyncRequired: false,
      maxCostUsd: null,
      fallbackToRules: false,
      hops: [hop('openai', 'gpt-4o-mini', 0), hop('gemini', 'gemini-1.5-flash', 1)],
    });

    let openaiAttempts = 0;
    const calls: string[] = [];
    const engine = new AiRouterEngine();
    const result = await engine.execute(
      { taskType: 'GENERAL_CHAT', feature: 'TEST' },
      async (ctx) => {
        calls.push(ctx.hop.providerKey);
        if (ctx.hop.providerKey === 'openai') {
          openaiAttempts += 1;
          throw new Error('ETIMEDOUT');
        }
        return { ok: true };
      },
    );

    expect(openaiAttempts).toBe(1);
    expect(calls).toEqual(['openai', 'gemini']);
    expect(result.usedHop.providerKey).toBe('gemini');
  });

  it('skips hops that exceed route maxCostUsd budget', async () => {
    estimateCostUsdMock.mockImplementation(async (providerKey: string) =>
      providerKey === 'openai' ? 0.01 : 0.001,
    );
    aiFailoverRuleFindMany.mockResolvedValueOnce([]);
    resolveRouteMock.mockResolvedValueOnce({
      routeId: 'route-1',
      routeKey: 'test',
      taskType: 'GENERAL_CHAT',
      scopeKey: 'platform',
      name: 'Test',
      maxRetries: 0,
      timeoutMs: 2_000,
      asyncRequired: false,
      maxCostUsd: 0.005,
      fallbackToRules: false,
      hops: [hop('openai', 'gpt-4o-mini', 0), hop('gemini', 'gemini-1.5-flash', 1)],
    });

    const calls: string[] = [];
    const engine = new AiRouterEngine();
    const result = await engine.execute(
      {
        taskType: 'GENERAL_CHAT',
        feature: 'TEST',
        scopeKey: 'platform',
        estimatedInputTokens: 500,
        reservedOutputTokens: 800,
      },
      async (ctx) => {
        calls.push(ctx.hop.providerKey);
        return { ok: true };
      },
    );

    expect(calls).toEqual(['gemini']);
    expect(result.usedHop.providerKey).toBe('gemini');
    expect(result.attempts.some((a) => a.skippedReason === 'budget_exceeded')).toBe(true);
  });

  it('CostGateEngine estimates tokens from text length', () => {
    const gate = new CostGateEngine();
    expect(gate.estimateInputTokensFromText('hello world', 'extra')).toBeGreaterThan(0);
  });
});
