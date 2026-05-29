/** Bump when cost coefficients change — stored on each AiUsageRecord row. */
export const AI_RATE_VERSION = '2026-05-30';

const BILLABLE_PROVIDERS = new Set(['openai', 'anthropic']);

export function computeTotalTokens(inputTokens: number, outputTokens: number): number {
  return inputTokens + outputTokens;
}

export function isBillableProvider(provider: string): boolean {
  return BILLABLE_PROVIDERS.has(provider);
}

export function isBillableUsage(provider: string, success: boolean): boolean {
  return success && isBillableProvider(provider);
}

export interface TokenAccounting {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billable: boolean;
  billableTokens: number;
  billableCostUsd: number;
}

export function accountTokens(params: {
  provider: string;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}): TokenAccounting {
  const totalTokens = computeTotalTokens(params.inputTokens, params.outputTokens);
  const billable = isBillableUsage(params.provider, params.success);
  const billableTokens = billable ? totalTokens : 0;
  const billableCostUsd = billable ? params.costUsd : 0;
  return {
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    totalTokens,
    billable,
    billableTokens,
    billableCostUsd,
  };
}
