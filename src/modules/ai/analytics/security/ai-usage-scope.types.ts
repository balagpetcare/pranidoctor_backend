import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';

export type AnalyticsScopeLevel = 'platform' | 'organization' | 'branch';

export interface ResolvedAnalyticsScope {
  level: AnalyticsScopeLevel;
  organizationId?: string;
  branchId?: string;
}

export type ScopeGuardSuccess = {
  ok: true;
  filters: UsageAnalyticsFilters;
  scope: ResolvedAnalyticsScope;
};

export type ScopeGuardFailure = {
  ok: false;
  code: 'SCOPE_FORBIDDEN';
  message: string;
  reason: string;
};

export type ScopeGuardResult = ScopeGuardSuccess | ScopeGuardFailure;

export interface ScopeGuardContext {
  route?: string;
}
