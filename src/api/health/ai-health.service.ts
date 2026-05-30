import { getAiGovernanceService } from '../../modules/ai/governance/ai-governance.service.js';
import { getAiOrchestratorService } from '../../modules/ai/orchestrator/ai-orchestrator.service.js';
import { AnthropicProvider } from '../../modules/ai/orchestrator/providers/anthropic.provider.js';
import { OpenAiProvider } from '../../modules/ai/orchestrator/providers/openai.provider.js';

import type { HealthCheckResult } from './health.types.js';

function listProviderConfig(): Array<{ name: string; configured: boolean }> {
  return [
    { name: 'openai', configured: new OpenAiProvider().isConfigured() },
    { name: 'anthropic', configured: new AnthropicProvider().isConfigured() },
  ];
}

/**
 * Lightweight AI health — configuration and kill-switch only (no external LLM calls).
 */
export async function checkAiHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  const orchestrator = getAiOrchestratorService();
  const governance = getAiGovernanceService();
  const llmDisabled = orchestrator.isLlmDisabled();
  const scopes = governance.getScopeSnapshot();
  const preferredProvider = (process.env.AI_PROVIDER ?? 'openai').trim().toLowerCase();
  const providers = listProviderConfig();
  const anyLlmConfigured = providers.some((provider) => provider.configured);
  const preferredConfigured =
    providers.find((provider) => provider.name === preferredProvider)?.configured ?? false;

  let status: HealthCheckResult['status'] = 'healthy';
  let message: string | undefined;

  if (llmDisabled) {
    status = 'degraded';
    message = 'LLM kill switch active — rules-based mode only';
  } else if (!anyLlmConfigured) {
    status = 'degraded';
    message = 'No LLM API keys configured — rules-based fallback only';
  } else if (!preferredConfigured) {
    status = 'degraded';
    message = `Preferred provider (${preferredProvider}) not configured — fallback chain active`;
  }

  return {
    name: 'ai',
    status,
    latency: Date.now() - start,
    ...(message && { message }),
    details: {
      llmDisabled,
      governanceHydrated: governance.isHydrated(),
      environment: (process.env.NODE_ENV ?? 'development').trim(),
      scopes,
      preferredProvider,
      providers,
      rulesFallbackAvailable: true,
    },
  };
}
