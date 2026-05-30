import type { TokenAccounting } from './ai-usage.tokens.js';

export interface RollupKey {
  bucketDate: Date;
  feature: string;
  provider: string;
  model: string;
}

export interface RollupCreateFields extends RollupKey {
  requestCount: number;
  successCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billableTokens: number;
  costUsd: number;
  billableCostUsd: number;
  latencyMsSum: number;
}

export function buildPlatformRollupFields(
  key: RollupKey,
  success: boolean,
  tokens: TokenAccounting,
  costUsd: number,
  latencyMs: number,
): { create: RollupCreateFields; update: Record<string, unknown> } {
  return {
    create: {
      ...key,
      requestCount: 1,
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
      billableTokens: tokens.billableTokens,
      costUsd,
      billableCostUsd: tokens.billableCostUsd,
      latencyMsSum: latencyMs,
    },
    update: {
      requestCount: { increment: 1 },
      ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
      inputTokens: { increment: tokens.inputTokens },
      outputTokens: { increment: tokens.outputTokens },
      totalTokens: { increment: tokens.totalTokens },
      billableTokens: { increment: tokens.billableTokens },
      costUsd: { increment: costUsd },
      billableCostUsd: { increment: tokens.billableCostUsd },
      latencyMsSum: { increment: latencyMs },
    },
  };
}

export function buildScopedRollupFields(
  tokens: TokenAccounting,
  costUsd: number,
): {
  create: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
    billableCostUsd: number;
  };
  update: Record<string, unknown>;
} {
  return {
    create: {
      requestCount: 1,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
      billableTokens: tokens.billableTokens,
      costUsd,
      billableCostUsd: tokens.billableCostUsd,
    },
    update: {
      requestCount: { increment: 1 },
      inputTokens: { increment: tokens.inputTokens },
      outputTokens: { increment: tokens.outputTokens },
      totalTokens: { increment: tokens.totalTokens },
      billableTokens: { increment: tokens.billableTokens },
      costUsd: { increment: costUsd },
      billableCostUsd: { increment: tokens.billableCostUsd },
    },
  };
}

export interface MonthlyRollupKey {
  bucketMonth: Date;
  dimensionType: string;
  dimensionId: string;
  provider: string;
  model: string;
}

export function buildMonthlyRollupFields(
  key: MonthlyRollupKey,
  success: boolean,
  tokens: TokenAccounting,
  costUsd: number,
  latencyMs: number,
  isTimeout: boolean,
): { create: Record<string, unknown>; update: Record<string, unknown> } {
  return {
    create: {
      ...key,
      requestCount: 1,
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      totalTokens: tokens.totalTokens,
      costUsd,
      latencyMsSum: latencyMs,
      timeoutCount: isTimeout ? 1 : 0,
    },
    update: {
      requestCount: { increment: 1 },
      ...(success ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
      inputTokens: { increment: tokens.inputTokens },
      outputTokens: { increment: tokens.outputTokens },
      totalTokens: { increment: tokens.totalTokens },
      costUsd: { increment: costUsd },
      latencyMsSum: { increment: latencyMs },
      ...(isTimeout ? { timeoutCount: { increment: 1 } } : {}),
    },
  };
}
