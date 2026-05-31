import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';

import type { AnalyticsFreshnessMetadata } from './ai-analytics-freshness.service.js';

export interface AnalyticsSummaryEnvelope<T> {
  range: { from: string; to: string };
  generatedAt: string;
  source: 'rollup' | 'log';
  data: T;
  freshness?: AnalyticsFreshnessMetadata;
}

export interface UsageSummary {
  requests: number;
  successes: number;
  failures: number;
  successRate: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  uniqueUsers: number;
  uniqueBranches: number;
  fallbackCount: number;
  byFeature: Array<{
    feature: string;
    requests: number;
    totalTokens: number;
  }>;
}

export interface CostSummary {
  costUsd: number;
  billableCostUsd: number;
  avgCostPerRequest: number;
  daily: Array<{
    date: string;
    costUsd: number;
    billableCostUsd: number;
    requests: number;
  }>;
  monthly: Array<{
    month: string;
    costUsd: number;
    requests: number;
  }>;
  byProvider: Array<{
    provider: string;
    costUsd: number;
    shareOfCostPct: number;
  }>;
}

export interface ProviderSummaryRow {
  provider: string;
  providerId: string | null;
  requests: number;
  successes: number;
  failures: number;
  successRate: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  fallbackCount: number;
  shareOfCostPct: number;
  healthScore: number | null;
  enabled: boolean | null;
}

export interface ProviderSummary {
  providers: ProviderSummaryRow[];
  totalCostUsd: number;
}

export interface ModelSummaryRow {
  model: string;
  modelId: string | null;
  provider: string;
  modelFamily: string | null;
  requests: number;
  successes: number;
  totalTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  shareOfCostPct: number;
}

export interface ModelSummary {
  models: ModelSummaryRow[];
  totalCostUsd: number;
  byFamily: Array<{
    family: string;
    requests: number;
    costUsd: number;
  }>;
}

export interface PerformanceSummary {
  successRate: number;
  failureRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  timeoutCount: number;
  fallbackCount: number;
  fallbackRate: number;
  errorRate: number;
  byErrorCategory: Array<{
    category: string;
    count: number;
    sharePct: number;
  }>;
  topErrorCodes: Array<{
    errorCode: string;
    count: number;
  }>;
  latencyHistogram: Array<{
    bucket: string;
    count: number;
  }>;
}

export type SummaryFilters = UsageAnalyticsFilters;
