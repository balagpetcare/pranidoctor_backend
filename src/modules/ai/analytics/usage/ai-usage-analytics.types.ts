export interface UsageAnalyticsFilters {
  from: Date;
  to: Date;
  branchId?: string;
  organizationId?: string;
  tenantId?: string;
  userId?: string;
  feature?: string;
  provider?: string;
  taskType?: string;
}

export interface DailyCostPoint {
  date: string;
  costUsd: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requests: number;
}

export interface MonthlyCostPoint {
  month: string;
  costUsd: number;
  totalTokens: number;
  requests: number;
  dimensionType?: string;
  dimensionId?: string;
}

export interface ProviderComparisonRow {
  provider: string;
  requests: number;
  successes: number;
  failures: number;
  successRate: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgLatencyMs: number;
  shareOfCostPct: number;
}

export interface FeatureComparisonRow {
  feature: string;
  requests: number;
  totalTokens: number;
  costUsd: number;
  shareOfCostPct: number;
  topProvider: string;
}

export interface CostTrendPoint {
  period: string;
  costUsd: number;
  totalTokens: number;
  requests: number;
}

export interface UsageAnalyticsDashboard {
  range: { from: string; to: string };
  totals: {
    requests: number;
    successes: number;
    failures: number;
    totalTokens: number;
    costUsd: number;
  };
  dailyCost: DailyCostPoint[];
  monthlyCost: MonthlyCostPoint[];
  providerComparison: ProviderComparisonRow[];
  featureComparison: FeatureComparisonRow[];
  costTrends: CostTrendPoint[];
  topUsers: Array<{
    userId: string;
    requests: number;
    totalTokens: number;
    costUsd: number;
  }>;
  topBranches: Array<{
    branchId: string;
    requests: number;
    totalTokens: number;
    costUsd: number;
  }>;
}

export interface UsageReportRow {
  timestamp: string;
  userId: string | null;
  branchId: string | null;
  organizationId: string | null;
  feature: string;
  taskType: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
}

export interface UsageReportPayload {
  generatedAt: string;
  filters: UsageAnalyticsFilters;
  rows: UsageReportRow[];
  summary: {
    rowCount: number;
    totalTokens: number;
    costUsd: number;
  };
}
