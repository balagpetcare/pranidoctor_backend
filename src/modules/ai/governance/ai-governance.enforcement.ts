import { getAiGovernanceService } from './ai-governance.service.js';
import {
  normalizeFeatureKey,
  normalizeProviderKey,
  type AiGovernanceFeatureKey,
} from './ai-governance.scopes.js';

/**
 * Central enforcement for orchestrator and future worker LLM paths.
 * Fail-closed: when state is unknown, external LLM providers are not used.
 */
export function shouldUseRulesOnlyForFeature(feature: string): boolean {
  return getAiGovernanceService().shouldUseRulesOnlyForFeature(normalizeFeatureKey(feature));
}

export function isProviderGovernanceBlocked(providerName: string): boolean {
  return getAiGovernanceService().isProviderDisabled(normalizeProviderKey(providerName));
}

export function assertAiLlmExecutionAllowed(feature: string): void {
  getAiGovernanceService().assertLlmExecutionAllowed(normalizeFeatureKey(feature));
}

export function mapRouteToGovernanceFeature(path: string): AiGovernanceFeatureKey | null {
  if (path.includes('/briefing/daily')) return 'FARM_BRIEFING';
  if (path.includes('/farm-query')) return 'FARM_QUERY';
  if (path.includes('/chat')) return 'CHAT';
  if (path.includes('/voice/chat')) return 'CHAT';
  return null;
}
