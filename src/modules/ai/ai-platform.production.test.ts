import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiOrchestratorService } from './orchestrator/ai-orchestrator.service.js';
import type { AiProviderAdapter } from './orchestrator/provider.interface.js';
import {
  validateOpenAiProvider,
  validateAnthropicProvider,
} from './orchestrator/providers/provider.validation.js';
import { resetAiPlatformConfigCache } from './config/ai.config.js';

const recordAttemptMock = vi.fn();

vi.mock('./usage/ai-usage.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./usage/ai-usage.service.js')>();
  return {
    ...actual,
    getAiUsageService: () => ({
      recordAttempt: recordAttemptMock,
      getDailyCostAggregation: vi.fn(),
      getMonthlyCostAggregation: vi.fn(),
      getProviderMetrics: vi.fn(),
    }),
  };
});

vi.mock('./prompts/ai-prompt.service.js', () => ({
  getAiPromptService: () => ({
    resolveActive: vi.fn(),
    ensureDefaults: vi.fn(),
  }),
}));

vi.mock('../../../shared/security/rate-limit/rate-limit.service.js', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('./ai.repository.js', () => ({
  getAiRepository: () => ({
    resolveCustomerId: vi.fn().mockResolvedValue('customer-test-1'),
  }),
}));

vi.mock('./governance/ai-governance.enforcement.js', () => ({
  shouldUseRulesOnlyForFeature: () => false,
  isProviderGovernanceBlocked: () => false,
  assertAiLlmExecutionAllowed: () => undefined,
}));

const budgetStatusMock = vi.fn().mockResolvedValue({
  daily: { budgetUsd: 100, spentUsd: 0, remainingUsd: 100, exceeded: false },
  monthly: { budgetUsd: 1000, spentUsd: 0, remainingUsd: 1000, exceeded: false },
  blocked: false,
});
let budgetBlockedFlag = false;

vi.mock('./budget/ai-budget.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./budget/ai-budget.service.js')>();
  return {
    ...actual,
    getAiBudgetService: () => ({
      assertBudgetAllowsLlm: vi.fn().mockImplementation(async () => {
        await budgetStatusMock();
      }),
      isBudgetBlocked: vi.fn().mockImplementation(() => budgetBlockedFlag),
      getStatus: budgetStatusMock,
      checkBudgetAfterUsage: vi.fn(),
      resetForTests: vi.fn(),
    }),
  };
});

function mockProvider(
  name: 'openai' | 'anthropic' | 'rules-based',
  behavior: 'ok' | 'fail' | 'skip',
): AiProviderAdapter {
  return {
    name,
    isConfigured: () => behavior !== 'skip',
    complete: async () => {
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

describe('AI provider validation', () => {
  beforeEach(() => {
    resetAiPlatformConfigCache();
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('validates OpenAI key format', () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890';
    resetAiPlatformConfigCache();
    const result = validateOpenAiProvider();
    expect(result.configured).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid OpenAI key length', () => {
    process.env.OPENAI_API_KEY = 'short';
    resetAiPlatformConfigCache();
    const result = validateOpenAiProvider();
    expect(result.valid).toBe(false);
  });

  it('validates Anthropic key format', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345678901234567890';
    resetAiPlatformConfigCache();
    const result = validateAnthropicProvider();
    expect(result.configured).toBe(true);
    expect(result.valid).toBe(true);
  });
});

describe('AI orchestrator fallback chain', () => {
  beforeEach(() => {
    recordAttemptMock.mockClear();
    resetAiPlatformConfigCache();
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890';
  });

  it('falls back OpenAI → Anthropic → rules on failures', async () => {
    const orchestrator = new AiOrchestratorService();
    (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
      mockProvider('openai', 'fail'),
      mockProvider('anthropic', 'fail'),
      mockProvider('rules-based', 'ok'),
    ];

    const result = await orchestrator.complete({
      feature: 'CHAT',
      systemPrompt: 'sys',
      userMessage: 'hello',
      locale: 'en',
    });

    expect(result.provider).toBe('rules-based');
    expect(recordAttemptMock).toHaveBeenCalled();
    const failures = recordAttemptMock.mock.calls.filter((c) => c[0].success === false);
    expect(failures.length).toBeGreaterThanOrEqual(2);
  });

  it('uses Anthropic when OpenAI fails', async () => {
    const orchestrator = new AiOrchestratorService();
    (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
      mockProvider('openai', 'fail'),
      mockProvider('anthropic', 'ok'),
      mockProvider('rules-based', 'ok'),
    ];

    const result = await orchestrator.complete({
      feature: 'CHAT',
      systemPrompt: 'sys',
      userMessage: 'hello',
      locale: 'en',
    });

    expect(result.provider).toBe('anthropic');
  });
});

describe('AI budget controls', () => {
  beforeEach(() => {
    budgetBlockedFlag = false;
  });

  it('blocks LLM when budget exceeded and uses rules fallback', async () => {
    budgetBlockedFlag = true;

    const orchestrator = new AiOrchestratorService();
    (orchestrator as unknown as { providers: AiProviderAdapter[] }).providers = [
      mockProvider('openai', 'ok'),
      mockProvider('anthropic', 'ok'),
      mockProvider('rules-based', 'ok'),
    ];

    const result = await orchestrator.complete({
      feature: 'CHAT',
      systemPrompt: 'sys',
      userMessage: 'hello',
      locale: 'en',
    });

    expect(result.provider).toBe('rules-based');
  });
});

describe('AI usage metrics', () => {
  it('records timeout error code on failure metrics', async () => {
    const { recordAiUsageMetrics, renderAiUsagePrometheusLines, resetAiUsageMetricsForTests } =
      await import('./usage/ai-usage.metrics.js');

    resetAiUsageMetricsForTests();
    recordAiUsageMetrics({
      feature: 'CHAT',
      provider: 'openai',
      model: 'gpt-4o-mini',
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 5000,
      errorCode: 'timeout',
    });

    const text = renderAiUsagePrometheusLines().join('\n');
    expect(text).toContain('status="timeout"');
  });
});
