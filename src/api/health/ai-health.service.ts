import { getAiGovernanceService } from '../../modules/ai/governance/ai-governance.service.js';
import { getAiOrchestratorService } from '../../modules/ai/orchestrator/ai-orchestrator.service.js';
import { validateAllLlmProviders } from '../../modules/ai/orchestrator/providers/provider.validation.js';
import { getLatestProviderHealth } from '../../modules/ai/health/ai-health-probe.service.js';
import { getAiBudgetService } from '../../modules/ai/budget/ai-budget.service.js';
import { OpenAiProvider } from '../../modules/ai/orchestrator/providers/openai.provider.js';
import { AnthropicProvider } from '../../modules/ai/orchestrator/providers/anthropic.provider.js';

import type { HealthCheckResult } from './health.types.js';

function listProviderConfig(): Array<{ name: string; configured: boolean; valid: boolean }> {
  const validations = validateAllLlmProviders();
  return validations.map((v) => ({
    name: v.provider,
    configured: v.configured,
    valid: v.valid,
  }));
}

/**
 * AI health — configuration, kill-switch, provider validation, and latest probes.
 */
export async function checkAiHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  const orchestrator = getAiOrchestratorService();
  const governance = getAiGovernanceService();
  const llmDisabled = orchestrator.isLlmDisabled();
  const scopes = governance.getScopeSnapshot();
  const providers = listProviderConfig();
  const probeResults = getLatestProviderHealth();
  const budget = await getAiBudgetService().getStatus().catch(() => null);

  const anyLlmConfigured = providers.some((provider) => provider.configured);
  const anyLlmReachable = probeResults.some((p) => p.configured && p.reachable);

  let status: HealthCheckResult['status'] = 'healthy';
  let message: string | undefined;

  if (llmDisabled) {
    status = 'degraded';
    message = 'LLM kill switch active — rules-based mode only';
  } else if (!anyLlmConfigured) {
    status = 'degraded';
    message = 'No LLM API keys configured — rules-based fallback only';
  } else if (!anyLlmReachable && probeResults.some((p) => p.configured)) {
    status = 'degraded';
    message = 'All configured LLM providers failed health probe — fallback chain active';
  } else if (budget?.blocked) {
    status = 'degraded';
    message = 'AI budget exceeded — rules-based mode enforced';
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
      providers,
      providerProbes: probeResults,
      budget,
      rulesFallbackAvailable: true,
      openaiConfigured: new OpenAiProvider().isConfigured(),
      anthropicConfigured: new AnthropicProvider().isConfigured(),
    },
  };
}
