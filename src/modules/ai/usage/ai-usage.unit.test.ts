import { describe, expect, it } from 'vitest';

import { resetAiPlatformConfigCache } from '../config/ai.config.js';
import { estimateAiCostUsd, registerProviderRates, resolveDefaultModel } from './ai-usage.cost.js';
import { classifyProviderError } from './ai-usage.errors.js';
import { recordAiUsageMetrics, renderAiUsagePrometheusLines } from './ai-usage.metrics.js';

describe('ai-usage.cost', () => {
  it('estimates zero cost for rules-based provider', () => {
    expect(estimateAiCostUsd('rules-based', 'rules-based-v1', 1000, 500)).toBe(0);
  });

  it('estimates openai mini model cost', () => {
    const cost = estimateAiCostUsd('openai', 'gpt-4o-mini', 1_000_000, 500_000);
    expect(cost).toBeCloseTo(0.15 + 0.3, 6);
  });

  it('supports registering a future provider', () => {
    registerProviderRates('gemini', { inputPerToken: 0.0000001, outputPerToken: 0.0000004 });
    expect(estimateAiCostUsd('gemini', 'gemini-1.5-flash', 1000, 1000)).toBeCloseTo(0.0005, 6);
  });

  it('resolves default models from env fallbacks', () => {
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    resetAiPlatformConfigCache();
    expect(resolveDefaultModel('openai')).toBe('gpt-4o-mini');
    expect(resolveDefaultModel('rules-based')).toBe('rules-based-v1');
  });
});

describe('ai-usage.errors', () => {
  it('classifies rate limit errors', () => {
    expect(classifyProviderError(new Error('OpenAI error 429: rate limit'))).toBe('rate_limit');
  });

  it('classifies auth errors', () => {
    expect(classifyProviderError(new Error('Anthropic error 401: unauthorized'))).toBe('auth');
  });

  it('classifies generic provider errors', () => {
    expect(classifyProviderError(new Error('network failure'))).toBe('provider_error');
  });
});

describe('ai-usage.metrics', () => {
  it('exports prometheus lines for recorded attempts', () => {
    recordAiUsageMetrics({
      feature: 'CHAT',
      provider: 'openai',
      model: 'gpt-4o-mini',
      success: true,
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.001,
      latencyMs: 800,
    });

    recordAiUsageMetrics({
      feature: 'CHAT',
      provider: 'openai',
      model: 'gpt-4o-mini',
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 200,
    });

    const text = renderAiUsagePrometheusLines().join('\n');
    expect(text).toContain('ai_requests_total');
    expect(text).toContain('status="success"');
    expect(text).toContain('status="failure"');
    expect(text).toContain('ai_request_duration_seconds');
    expect(text).toContain('ai_llm_disabled');
  });
});
