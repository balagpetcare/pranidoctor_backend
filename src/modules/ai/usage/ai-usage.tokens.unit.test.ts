import { describe, expect, it } from 'vitest';

import {
  AI_RATE_VERSION,
  accountTokens,
  computeTotalTokens,
  isBillableUsage,
} from './ai-usage.tokens.js';
import { buildPlatformRollupFields, buildScopedRollupFields } from './ai-usage.rollups.js';

describe('ai-usage.tokens', () => {
  it('computes total tokens as input + output', () => {
    expect(computeTotalTokens(100, 50)).toBe(150);
  });

  it('marks openai/anthropic successes as billable', () => {
    expect(isBillableUsage('openai', true)).toBe(true);
    expect(isBillableUsage('anthropic', true)).toBe(true);
    expect(isBillableUsage('rules-based', true)).toBe(false);
    expect(isBillableUsage('openai', false)).toBe(false);
  });

  it('accounts billable tokens and cost separately from synthetic usage', () => {
    const llm = accountTokens({
      provider: 'openai',
      success: true,
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.00045,
    });
    expect(llm.totalTokens).toBe(1500);
    expect(llm.billableTokens).toBe(1500);
    expect(llm.billableCostUsd).toBe(0.00045);

    const rules = accountTokens({
      provider: 'rules-based',
      success: true,
      inputTokens: 200,
      outputTokens: 100,
      costUsd: 0,
    });
    expect(rules.totalTokens).toBe(300);
    expect(rules.billableTokens).toBe(0);
    expect(rules.billableCostUsd).toBe(0);
  });

  it('exports a stable rate version string', () => {
    expect(AI_RATE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('ai-usage.rollups', () => {
  it('builds platform rollup increments with billable token fields', () => {
    const tokens = accountTokens({
      provider: 'anthropic',
      success: true,
      inputTokens: 80,
      outputTokens: 40,
      costUsd: 0.00007,
    });
    const { create, update } = buildPlatformRollupFields(
      {
        bucketDate: new Date('2026-05-30'),
        feature: 'CHAT',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
      },
      true,
      tokens,
      0.00007,
      200,
    );
    expect(create.totalTokens).toBe(120);
    expect(create.billableTokens).toBe(120);
    expect(create.billableCostUsd).toBe(0.00007);
    expect(update.totalTokens).toEqual({ increment: 120 });
    expect(update.billableTokens).toEqual({ increment: 120 });
  });

  it('builds scoped rollup for user/tenant tables', () => {
    const tokens = accountTokens({
      provider: 'openai',
      success: true,
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.00001,
    });
    const scoped = buildScopedRollupFields(tokens, 0.00001);
    expect(scoped.create.totalTokens).toBe(15);
    expect(scoped.update.billableCostUsd).toEqual({ increment: 0.00001 });
  });
});
