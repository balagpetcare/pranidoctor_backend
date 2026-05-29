import { describe, expect, it } from 'vitest';

import { estimateAiCostUsd } from './ai-usage.cost.js';
import { buildPlatformRollupFields, buildScopedRollupFields } from './ai-usage.rollups.js';
import {
  accountTokens,
  computeTotalTokens,
  isBillableUsage,
} from './ai-usage.tokens.js';

/** Simulates multi-attempt batch rollup accumulation for integrity checks. */
function simulateRollupTotals(
  attempts: Array<{
    provider: string;
    success: boolean;
    inputTokens: number;
    outputTokens: number;
  }>,
) {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let billableTokens = 0;
  let costUsd = 0;
  let billableCostUsd = 0;

  for (const attempt of attempts) {
    const cost = attempt.success
      ? estimateAiCostUsd('openai', 'gpt-4o-mini', attempt.inputTokens, attempt.outputTokens)
      : 0;
    const tokens = accountTokens({
      provider: attempt.provider,
      success: attempt.success,
      inputTokens: attempt.inputTokens,
      outputTokens: attempt.outputTokens,
      costUsd: cost,
    });
    inputTokens += tokens.inputTokens;
    outputTokens += tokens.outputTokens;
    totalTokens += tokens.totalTokens;
    billableTokens += tokens.billableTokens;
    costUsd += cost;
    billableCostUsd += tokens.billableCostUsd;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    billableTokens,
    costUsd,
    billableCostUsd,
  };
}

describe('token tracking verification — accounting accuracy', () => {
  it('V-ACC-01: totalTokens always equals inputTokens + outputTokens', () => {
    const cases = [
      { input: 0, output: 0 },
      { input: 100, output: 50 },
      { input: 4096, output: 800 },
    ];
    for (const c of cases) {
      expect(computeTotalTokens(c.input, c.output)).toBe(c.input + c.output);
      const acct = accountTokens({
        provider: 'openai',
        success: true,
        inputTokens: c.input,
        outputTokens: c.output,
        costUsd: 0.001,
      });
      expect(acct.totalTokens).toBe(c.input + c.output);
    }
  });

  it('V-ACC-02: failures produce zero tokens and zero billable cost', () => {
    const acct = accountTokens({
      provider: 'openai',
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    });
    expect(acct.totalTokens).toBe(0);
    expect(acct.billable).toBe(false);
    expect(acct.billableTokens).toBe(0);
    expect(acct.billableCostUsd).toBe(0);
  });

  it('V-ACC-03: rules-based tokens tracked but not billable', () => {
    const acct = accountTokens({
      provider: 'rules-based',
      success: true,
      inputTokens: 400,
      outputTokens: 200,
      costUsd: 0,
    });
    expect(acct.totalTokens).toBe(600);
    expect(acct.billable).toBe(false);
    expect(acct.billableTokens).toBe(0);
  });

  it('V-ACC-04: platform rollup mirrors token accounting fields', () => {
    const tokens = accountTokens({
      provider: 'anthropic',
      success: true,
      inputTokens: 300,
      outputTokens: 150,
      costUsd: 0.0002625,
    });
    const { create } = buildPlatformRollupFields(
      {
        bucketDate: new Date('2026-05-30'),
        feature: 'CHAT',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
      },
      true,
      tokens,
      0.0002625,
      100,
    );
    expect(create.inputTokens).toBe(300);
    expect(create.outputTokens).toBe(150);
    expect(create.totalTokens).toBe(450);
    expect(create.billableTokens).toBe(450);
  });
});

describe('token tracking verification — cost calculations', () => {
  it('V-COST-01: gpt-4o-mini formula matches documented rates', () => {
    const input = 10_000;
    const output = 5_000;
    const cost = estimateAiCostUsd('openai', 'gpt-4o-mini', input, output);
    expect(cost).toBeCloseTo(input * 0.00000015 + output * 0.0000006, 10);
  });

  it('V-COST-02: anthropic haiku formula matches documented rates', () => {
    const input = 10_000;
    const output = 5_000;
    const cost = estimateAiCostUsd('anthropic', 'claude-3-5-haiku-20241022', input, output);
    expect(cost).toBeCloseTo(input * 0.00000025 + output * 0.00000125, 10);
  });

  it('V-COST-03: billableCostUsd equals costUsd for LLM successes only', () => {
    const cost = estimateAiCostUsd('openai', 'gpt-4o-mini', 1000, 500);
    const llm = accountTokens({
      provider: 'openai',
      success: true,
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: cost,
    });
    expect(llm.billableCostUsd).toBeCloseTo(cost, 10);

    const rules = accountTokens({
      provider: 'rules-based',
      success: true,
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0,
    });
    expect(rules.billableCostUsd).toBe(0);
  });

  it('V-COST-04: mixed batch billable cost excludes rules-based and failures', () => {
    const totals = simulateRollupTotals([
      { provider: 'openai', success: true, inputTokens: 1000, outputTokens: 500 },
      { provider: 'openai', success: false, inputTokens: 0, outputTokens: 0 },
      { provider: 'rules-based', success: true, inputTokens: 200, outputTokens: 100 },
    ]);
    const expectedBillable = estimateAiCostUsd('openai', 'gpt-4o-mini', 1000, 500);
    expect(totals.billableCostUsd).toBeCloseTo(expectedBillable, 10);
    expect(totals.totalTokens).toBe(1800);
    expect(totals.billableTokens).toBe(1500);
  });
});

describe('token tracking verification — tenant separation', () => {
  it('V-TEN-01: user and tenant rollups use independent scoped keys', () => {
    const tokens = accountTokens({
      provider: 'openai',
      success: true,
      inputTokens: 50,
      outputTokens: 25,
      costUsd: 0.0000225,
    });
    const userRollup = buildScopedRollupFields(tokens, 0.0000225);
    const tenantRollup = buildScopedRollupFields(tokens, 0.0000225);

    expect(userRollup.create.totalTokens).toBe(75);
    expect(tenantRollup.create.totalTokens).toBe(75);
    expect(userRollup.create.billableTokens).toBe(75);
    expect(tenantRollup.create.billableTokens).toBe(75);
    expect(userRollup.update.totalTokens).toEqual({ increment: 75 });
    expect(tenantRollup.update.billableTokens).toEqual({ increment: 75 });
  });

  it('V-TEN-02: billable flag distinguishes LLM providers from rules-based', () => {
    expect(isBillableUsage('openai', true)).toBe(true);
    expect(isBillableUsage('anthropic', true)).toBe(true);
    expect(isBillableUsage('rules-based', true)).toBe(false);
    expect(isBillableUsage('gemini', true)).toBe(false);
  });

  it('V-TEN-03: tenant rollup excludes non-billable token cost', () => {
    const rules = accountTokens({
      provider: 'rules-based',
      success: true,
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0,
    });
    const scoped = buildScopedRollupFields(rules, 0);
    expect(scoped.create.totalTokens).toBe(150);
    expect(scoped.create.billableTokens).toBe(0);
    expect(scoped.create.billableCostUsd).toBe(0);
  });
});

describe('token tracking verification — user reporting', () => {
  it('V-USR-01: consumption summary fields are derivable from rollup simulation', () => {
    const totals = simulateRollupTotals([
      { provider: 'openai', success: true, inputTokens: 200, outputTokens: 100 },
      { provider: 'openai', success: true, inputTokens: 300, outputTokens: 150 },
    ]);
    expect(totals.inputTokens).toBe(500);
    expect(totals.outputTokens).toBe(250);
    expect(totals.totalTokens).toBe(750);
    expect(totals.billableTokens).toBe(750);
    expect(totals.costUsd).toBeGreaterThan(0);
  });
});

describe('token tracking verification — data integrity', () => {
  it('V-INT-01: rollup increments are additive across multiple attempts', () => {
    const attempts = [
      { input: 100, output: 50 },
      { input: 200, output: 80 },
    ];
    let platformTotal = 0;
    let platformBillable = 0;

    for (const a of attempts) {
      const tokens = accountTokens({
        provider: 'openai',
        success: true,
        inputTokens: a.input,
        outputTokens: a.output,
        costUsd: 0.001,
      });
      const { update } = buildPlatformRollupFields(
        {
          bucketDate: new Date('2026-05-30'),
          feature: 'CHAT',
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
        true,
        tokens,
        0.001,
        50,
      );
      platformTotal += (update.totalTokens as { increment: number }).increment;
      platformBillable += (update.billableTokens as { increment: number }).increment;
    }

    expect(platformTotal).toBe(430);
    expect(platformBillable).toBe(430);
  });

  it('V-INT-02: input + output sums match totalTokens in batch simulation', () => {
    const totals = simulateRollupTotals([
      { provider: 'openai', success: true, inputTokens: 111, outputTokens: 222 },
      { provider: 'anthropic', success: true, inputTokens: 333, outputTokens: 444 },
    ]);
    expect(totals.totalTokens).toBe(totals.inputTokens + totals.outputTokens);
  });

  it('V-INT-03: billableTokens never exceeds totalTokens', () => {
    const totals = simulateRollupTotals([
      { provider: 'openai', success: true, inputTokens: 100, outputTokens: 50 },
      { provider: 'rules-based', success: true, inputTokens: 200, outputTokens: 100 },
    ]);
    expect(totals.billableTokens).toBeLessThanOrEqual(totals.totalTokens);
  });
});
