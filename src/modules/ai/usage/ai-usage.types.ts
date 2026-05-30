export type AiUsageAttemptStatus = 'success' | 'failure';

export interface AiUsageAttemptInput {
  userId?: string;
  customerId?: string;
  organizationId?: string;
  branchId?: string;
  clinicId?: string;
  doctorId?: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  isFallback?: boolean;
  fromProvider?: string;
  /** AIMS analytics extensions */
  taskType?: string;
  routeId?: string;
  providerId?: string;
  modelId?: string;
  promptId?: string;
  failoverRuleId?: string;
  requestId?: string;
  correlationId?: string;
  scopeKey?: string;
  tenantId?: string;
}

export interface AiUsageSummaryRow {
  feature: string;
  provider: string;
  model: string;
  requests: number;
  successes: number;
  failures: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billableTokens: number;
  costUsd: number;
  billableCostUsd: number;
  avgLatencyMs: number;
}

export interface AiTokenConsumptionSummary {
  since: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  billableTokens: number;
  costUsd: number;
  billableCostUsd: number;
  byFeature: Array<{
    feature: string;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
  }>;
}

export interface AiUsageSummary {
  since: string;
  totals: {
    requests: number;
    successes: number;
    failures: number;
    successRate: number;
    failureRate: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
    billableCostUsd: number;
    avgLatencyMs: number;
    fallbackCount: number;
  };
  byFeatureProvider: AiUsageSummaryRow[];
  byModel: Array<{
    provider: string;
    model: string;
    requests: number;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
  }>;
  topUsers: Array<{
    userId: string;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
  }>;
  topCustomers: Array<{
    customerId: string;
    totalTokens: number;
    billableTokens: number;
    costUsd: number;
  }>;
}
