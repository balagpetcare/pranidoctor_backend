import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAiOrchestratorService } from '../../modules/ai/orchestrator/ai-orchestrator.service.js';

import { checkAiHealth } from './ai-health.service.js';

describe('checkAiHealth', () => {
  const envBackup = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    provider: process.env.AI_PROVIDER,
  };

  beforeEach(() => {
    getAiOrchestratorService().enableLlm();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = envBackup.openai;
    process.env.ANTHROPIC_API_KEY = envBackup.anthropic;
    process.env.AI_PROVIDER = envBackup.provider;
    getAiOrchestratorService().enableLlm();
  });

  it('returns healthy when preferred provider is configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_PROVIDER = 'openai';

    const result = await checkAiHealth();

    expect(result.name).toBe('ai');
    expect(result.status).toBe('healthy');
    expect(result.details?.llmDisabled).toBe(false);
  });

  it('returns degraded when kill switch is active', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    getAiOrchestratorService().disableLlm();

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toContain('kill switch');
  });

  it('returns degraded when no LLM keys are configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.details?.rulesFallbackAvailable).toBe(true);
  });

  it('returns degraded when preferred provider is missing but fallback exists', async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.AI_PROVIDER = 'openai';

    const result = await checkAiHealth();

    expect(result.status).toBe('degraded');
    expect(result.message).toContain('Preferred provider');
  });
});
