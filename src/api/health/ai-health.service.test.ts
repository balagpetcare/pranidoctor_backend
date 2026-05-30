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

const secretConfiguredMock = vi.fn().mockReturnValue(false);

vi.mock('../../modules/ai/vault/ai-secret.service.js', () => ({
  getAiSecretService: () => ({
    isProviderConfigured: secretConfiguredMock,
    refreshConfigurationCache: vi.fn(),
    resolveProviderSecret: vi.fn(),
  }),
}));

vi.mock('../../modules/ai/budget/ai-budget.service.js', () => ({
  getAiBudgetService: () => ({
    getStatus: getStatusMock,
  }),
}));

describe('checkAiHealth', () => {
  beforeEach(() => {
    resetAiPlatformConfigCache();
    resetAiHealthProbeForTests();
    getAiOrchestratorService().enableLlm();
    secretConfiguredMock.mockReset();
    secretConfiguredMock.mockReturnValue(false);
    getStatusMock.mockResolvedValue({
      daily: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      monthly: { budgetUsd: null, spentUsd: 0, remainingUsd: null, exceeded: false },
      blocked: false,
    });
  });

  afterEach(() => {
    resetAiPlatformConfigCache();
    getAiOrchestratorService().enableLlm();
  });

  it('returns healthy when a provider is configured', async () => {
    secretConfiguredMock.mockImplementation((key: string) => key === 'openai');

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
    secretConfiguredMock.mockReturnValue(false);

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.details?.rulesFallbackAvailable).toBe(true);
  });

  it('returns degraded when budget is exceeded', async () => {
    secretConfiguredMock.mockReturnValue(true);
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
