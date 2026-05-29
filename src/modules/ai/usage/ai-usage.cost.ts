export interface AiTokenRates {
  inputPerToken: number;
  outputPerToken: number;
}

/** Per-provider default rates (USD per token). Override per model when needed. */
const PROVIDER_RATES: Record<string, AiTokenRates> = {
  openai: { inputPerToken: 0.00000015, outputPerToken: 0.0000006 },
  anthropic: { inputPerToken: 0.00000025, outputPerToken: 0.00000125 },
  'rules-based': { inputPerToken: 0, outputPerToken: 0 },
};

/** Optional model-specific overrides (provider → model id → rates). */
const MODEL_RATES: Record<string, Record<string, AiTokenRates>> = {
  openai: {
    'gpt-4o': { inputPerToken: 0.0000025, outputPerToken: 0.00001 },
    'gpt-4o-mini': { inputPerToken: 0.00000015, outputPerToken: 0.0000006 },
  },
  anthropic: {
    'claude-3-5-haiku-20241022': {
      inputPerToken: 0.00000025,
      outputPerToken: 0.00000125,
    },
    'claude-3-5-sonnet-20241022': {
      inputPerToken: 0.000003,
      outputPerToken: 0.000015,
    },
  },
};

export function resolveDefaultModel(provider: string): string {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
    case 'anthropic':
      return process.env.ANTHROPIC_MODEL?.trim() || 'claude-3-5-haiku-20241022';
    case 'rules-based':
      return 'rules-based-v1';
    default:
      return 'unknown';
  }
}

export function estimateAiCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const modelRates = MODEL_RATES[provider]?.[model];
  const rates = modelRates ?? PROVIDER_RATES[provider] ?? { inputPerToken: 0, outputPerToken: 0 };
  return inputTokens * rates.inputPerToken + outputTokens * rates.outputPerToken;
}

/** Register rates for a new provider at runtime (e.g. plugin bootstrap). */
export function registerProviderRates(provider: string, rates: AiTokenRates): void {
  PROVIDER_RATES[provider] = rates;
}

export function registerModelRates(
  provider: string,
  model: string,
  rates: AiTokenRates,
): void {
  if (!MODEL_RATES[provider]) MODEL_RATES[provider] = {};
  MODEL_RATES[provider][model] = rates;
}
