import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAiOrchestratorService } from '../../modules/ai/orchestrator/ai-orchestrator.service.js';
import { resetAiPlatformConfigCache } from '../../modules/ai/config/ai.config.js';
import { resetAiHealthProbeForTests } from '../../modules/ai/health/ai-health-probe.service.js';

import { checkAiHealth } from './ai-health.service.js';

const getStatusMock = vi.fn().mockResolvedValue({
  daily: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
  monthly: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
  blocked: false,
});

vi.mock('../../modules/ai/budget/ai-budget.service.js', () => ({
  getAiBudgetService: () => ({
    getStatus: getStatusMock,
  }),
}));

describe('checkAiHealth', () => {
  const envBackup = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  beforeEach(() => {
    resetAiPlatformConfigCache();
    resetAiHealthProbeForTests();
    getAiOrchestratorService().enableLlm();
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890';
    getStatusMock.mockResolvedValue({
      daily: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      monthly: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      blocked: false,
    });
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = envBackup.openai;
    process.env.ANTHROPIC_API_KEY = envBackup.anthropic;
    resetAiPlatformConfigCache();
    getAiOrchestratorService().enableLlm();
  });

  it('returns healthy when a provider is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    resetAiPlatformConfigCache();

    const result = await checkAiHealth();

    expect(result.name).toBe('ai');
    expect(result.status).toBe('healthy');
    expect(result.details?.llmDisabled).toBe(false);
  });

  it('returns degraded when kill switch is active', async () => {
    getAiOrchestratorService().disableLlm();

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toContain('kill switch');
  });

  it('returns degraded when no LLM keys are configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    resetAiPlatformConfigCache();

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.details?.rulesFallbackAvailable).toBe(true);
  });

  it('returns degraded when budget is exceeded', async () => {
    getStatusMock.mockResolvedValueOnce({
      daily: { budgetUsd: 10, spentUsd: 12, remainingUsd: 0, exceeded: true },
      monthly: { budgetUsd: 100, spentUsd: 12, remainingUsd: 88, exceeded: false },
      blocked: true,
    });

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toContain('budget');
  });
});
