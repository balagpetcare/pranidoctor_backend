export const AI_GOVERNANCE_SCOPE_TYPES = ['feature', 'provider'] as const;
export type AiGovernanceScopeType = (typeof AI_GOVERNANCE_SCOPE_TYPES)[number];

/** LLM-backed features governed by the orchestrator kill switch. */
export const AI_GOVERNANCE_FEATURES = ['CHAT', 'FARM_BRIEFING', 'FARM_QUERY'] as const;
export type AiGovernanceFeatureKey = (typeof AI_GOVERNANCE_FEATURES)[number];

/** External LLM providers (rules-based is never kill-switched). */
export const AI_GOVERNANCE_PROVIDERS = ['openai', 'anthropic'] as const;
export type AiGovernanceProviderKey = (typeof AI_GOVERNANCE_PROVIDERS)[number];

export type AiGovernanceScopeSnapshot = {
  features: Record<string, boolean>;
  providers: Record<string, boolean>;
};

export function normalizeFeatureKey(feature: string): string {
  return feature.trim().toUpperCase();
}

export function normalizeProviderKey(provider: string): string {
  return provider.trim().toLowerCase();
}

export function isKnownFeature(feature: string): feature is AiGovernanceFeatureKey {
  return (AI_GOVERNANCE_FEATURES as readonly string[]).includes(normalizeFeatureKey(feature));
}

export function isKnownProvider(provider: string): provider is AiGovernanceProviderKey {
  return (AI_GOVERNANCE_PROVIDERS as readonly string[]).includes(normalizeProviderKey(provider));
}

export function emptyScopeSnapshot(): AiGovernanceScopeSnapshot {
  const features: Record<string, boolean> = {};
  const providers: Record<string, boolean> = {};
  for (const f of AI_GOVERNANCE_FEATURES) features[f] = false;
  for (const p of AI_GOVERNANCE_PROVIDERS) providers[p] = false;
  return { features, providers };
}

export function parseScopeSnapshot(raw: unknown): AiGovernanceScopeSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { features?: unknown; providers?: unknown };
  if (typeof o.features !== 'object' || o.features === null) return null;
  if (typeof o.providers !== 'object' || o.providers === null) return null;
  const features: Record<string, boolean> = {};
  const providers: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(o.features as Record<string, unknown>)) {
    if (typeof v === 'boolean') features[normalizeFeatureKey(k)] = v;
  }
  for (const [k, v] of Object.entries(o.providers as Record<string, unknown>)) {
    if (typeof v === 'boolean') providers[normalizeProviderKey(k)] = v;
  }
  return { features, providers };
}
