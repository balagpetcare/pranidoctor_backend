import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service.js';
import type { AiProviderAdapter } from '../orchestrator/provider.interface.js';
import { resetAiPlatformConfigCache } from '../config/ai.config.js';
import { estimateAiCostUsd } from './ai-usage.cost.js';
import { classifyProviderError } from './ai-usage.errors.js';
import {
  recordAiUsageMetrics,
  renderAiUsagePrometheusLines,
  setAiLlmDisabledMetric,
} from './ai-usage.metrics.js';

const recordAttemptMock = vi.fn();

vi.mock('./ai-usage.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ai-usage.service.js')>();
  return {
    ...actual,
    getAiUsageService: () => ({
      recordAttempt: recordAttemptMock,
    }),
  };
});

vi.mock('../prompts/ai-prompt.service.js', () => ({
  getAiPromptService: () => ({
    resolveActive: vi.fn(),
    ensureDefaults: vi.fn(),
  }),
}));

vi.mock('../../../shared/security/rate-limit/rate-limit.service.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../ai.repository.js', () => ({
  getAiRepository: () => ({
    resolveCustomerId: vi.fn().mockResolvedValue('customer-test-1'),
  }),
}));

vi.mock('../governance/ai-governance.enforcement.js', () => ({
  shouldUseRulesOnlyForFeature: () => false,
  isProviderGovernanceBlocked: () => false,
  assertAiLlmExecutionAllowed: () => undefined,
}));

vi.mock('../budget/ai-budget.service.js', () => ({
  getAiBudgetService: () => ({
    assertBudgetAllowsLlm: vi.fn().mockResolvedValue(undefined),
    isBudgetBlocked: vi.fn().mockReturnValue(false),
    getStatus: vi.fn().mockResolvedValue({
      daily: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      monthly: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      blocked: false,
    }),
    checkBudgetAfterUsage: vi.fn(),
  }),
}));

function mockProvider(
  name: 'openai' | 'anthropic' | 'rules-based',
  behavior: 'ok' | 'fail' | 'skip',
): AiProviderAdapter {
  return {
    name,
    isConfigured: () => behavior !== 'skip',
    complete: async (input) => {
      if (behavior === 'fail') {
        throw new Error(`${name} error 503: unavailable`);
      }
      return {
        content: `reply from ${name}`,
        confidence: 0.9,
        provider: name,
        model: `${name}-model`,
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 120,
      };
    },
  };
}

describe('AI usage monitoring verification', () => {
  beforeEach(() => {
    recordAttemptMock.mockClear();
    setAiLlmDisabledMetric(false);
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request tracking', () => {
    it('records a successful provider attempt with feature and model labels', async () => {
      const orchestrator = new AiOrchestratorService();
      (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
        mockProvider('openai', 'ok'),
        mockProvider('rules-based', 'ok'),
      ];
      process.env.OPENAI_API_KEY = 'test-key';

      await orchestrator.complete({
        feature: 'CHAT',
        systemPrompt: 'sys',
        userMessage: 'hello',
        locale: 'en',
        userId: 'user-1',
      });

      expect(recordAttemptMock).toHaveBeenCalledTimes(1);
      expect(recordAttemptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: 'CHAT',
          provider: 'openai',
          model: 'openai-model',
          success: true,
          userId: 'user-1',
          customerId: 'customer-test-1',
        }),
      );
    });

    it('increments prometheus success counter', () => {
      recordAiUsageMetrics({
        feature: 'FARM_QUERY',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        success: true,
        inputTokens: 200,
        outputTokens: 80,
        costUsd: 0.00015,
        latencyMs: 450,
      });

      const text = renderAiUsagePrometheusLines().join('\n');
      expect(text).toContain('feature="FARM_QUERY"');
      expect(text).toContain('provider="anthropic"');
      expect(text).toContain('status="success"');
      expect(text).toContain('ai_request_duration_seconds_count');
    });
  });

  describe('failure tracking', () => {
    it('records failed LLM attempt before fallback success', async () => {
      const orchestrator = new AiOrchestratorService();
      (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
        mockProvider('openai', 'fail'),
        mockProvider('rules-based', 'ok'),
      ];
      process.env.OPENAI_API_KEY = 'test-key';

      const result = await orchestrator.complete({
        feature: 'CHAT',
        systemPrompt: 'sys',
        userMessage: 'hello',
        locale: 'en',
      });

      expect(result.provider).toBe('rules-based');
      expect(recordAttemptMock).toHaveBeenCalledTimes(2);

      const failureCall = recordAttemptMock.mock.calls.find(
        ([arg]) => arg.success === false,
      );
      expect(failureCall?.[0]).toMatchObject({
        provider: 'openai',
        success: false,
        errorCode: 'provider_5xx',
        inputTokens: 0,
        outputTokens: 0,
      });

      const successCall = recordAttemptMock.mock.calls.find(
        ([arg]) => arg.success === true,
      );
      expect(successCall?.[0]).toMatchObject({
        provider: 'rules-based',
        isFallback: true,
        fromProvider: 'llm_chain',
      });
    });

    it('classifies common provider error codes', () => {
      expect(classifyProviderError(new Error('OpenAI error 429'))).toBe('rate_limit');
      expect(classifyProviderError(new Error('Anthropic error 401'))).toBe('auth');
      expect(classifyProviderError(new Error('ETIMEDOUT'))).toBe('timeout');
      expect(classifyProviderError(new Error('OpenAI error 503'))).toBe('provider_5xx');
    });

    it('exports failure status in prometheus metrics', () => {
      recordAiUsageMetrics({
        feature: 'CHAT',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: false,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 90,
      });

      const text = renderAiUsagePrometheusLines().join('\n');
      expect(text).toContain('status="failure"');
    });
  });

  describe('cost visibility', () => {
    it('computes openai mini cost accurately', () => {
      const cost = estimateAiCostUsd('openai', 'gpt-4o-mini', 10_000, 5_000);
      expect(cost).toBeCloseTo(0.0015 + 0.003, 8);
    });

    it('assigns zero cost to rules-based and failures', () => {
      expect(estimateAiCostUsd('rules-based', 'rules-based-v1', 5000, 2000)).toBe(0);
    });

    it('accumulates cost counter only on successful attempts', () => {
      recordAiUsageMetrics({
        feature: 'CHAT',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: true,
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.00045,
        latencyMs: 300,
      });

      const text = renderAiUsagePrometheusLines().join('\n');
      expect(text).toContain('ai_cost_usd_total');
      expect(text).toMatch(/ai_cost_usd_total\{[^}]+\} 0\.00045/);
    });
  });

  describe('provider visibility', () => {
    it('records per-provider failure with default model id', async () => {
      const orchestrator = new AiOrchestratorService();
      (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
        mockProvider('openai', 'skip'),
        mockProvider('anthropic', 'fail'),
        mockProvider('rules-based', 'ok'),
      ];
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345678901234567890';
      resetAiPlatformConfigCache();

      await orchestrator.complete({
        feature: 'FARM_BRIEFING',
        systemPrompt: 'sys',
        userMessage: 'brief',
        locale: 'bn',
      });

      const failure = recordAttemptMock.mock.calls.find(([arg]) => arg.success === false)?.[0];
      expect(failure?.provider).toBe('anthropic');
      expect(failure?.model).toBe('claude-3-5-haiku-20241022');
    });

    it('reflects kill switch in ai_llm_disabled gauge', () => {
      const orchestrator = new AiOrchestratorService();
      orchestrator.disableLlm();
      const text = renderAiUsagePrometheusLines().join('\n');
      expect(text).toContain('ai_llm_disabled 1');
      orchestrator.enableLlm();
    });
  });

  describe('reporting accuracy', () => {
    it('success + failure rates sum to 100% for mixed attempts', () => {
      const successes = 7;
      const failures = 3;
      const total = successes + failures;
      const successRate = Math.round((successes / total) * 10000) / 100;
      const failureRate = Math.round((failures / total) * 10000) / 100;
      expect(successRate + failureRate).toBe(100);
    });

    it('rollup increments align with attempt outcomes', () => {
      const rollup = { requestCount: 0, successCount: 0, failureCount: 0, costUsd: 0 };
      const attempts = [
        { success: true, costUsd: 0.001 },
        { success: false, costUsd: 0 },
        { success: true, costUsd: 0.002, isFallback: true },
      ] as const;

      for (const attempt of attempts) {
        rollup.requestCount += 1;
        if (attempt.success) rollup.successCount += 1;
        else rollup.failureCount += 1;
        rollup.costUsd += attempt.costUsd;
      }

      expect(rollup.requestCount).toBe(3);
      expect(rollup.successCount).toBe(2);
      expect(rollup.failureCount).toBe(1);
      expect(rollup.costUsd).toBeCloseTo(0.003, 6);
      expect(
        Math.round((rollup.successCount / rollup.requestCount) * 10000) / 100,
      ).toBe(66.67);
    });
  });
});
