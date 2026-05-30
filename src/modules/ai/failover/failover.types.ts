import type { RouteHop, ResolvedRoute } from '../routing/ai-router.types.js';

export type FailoverTier = 'primary' | 'secondary' | 'tertiary' | 'fallback';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold: number;
}

export interface ProviderHealthSnapshot {
  providerKey: string;
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  circuitState: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  healthScore: number;
  errorCode?: string;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
}

export interface FailoverExecutionRequest {
  taskType: string;
  tenantId?: string | null;
  branchId?: string | null;
  feature: string;
}

export interface FailoverHopAttempt {
  tier: FailoverTier;
  hop: RouteHop;
  attempt: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  skippedReason?: string;
}

export interface FailoverHopContext {
  hop: RouteHop;
  tier: FailoverTier;
  timeoutMs: number;
  attempt: number;
  route: ResolvedRoute;
}

export type FailoverHopExecutor<T> = (ctx: FailoverHopContext) => Promise<T>;

export interface FailoverExecutionResult<T> {
  result: T;
  route: ResolvedRoute;
  usedHop: RouteHop;
  tier: FailoverTier;
  attempts: FailoverHopAttempt[];
  isFallback: boolean;
}

export interface DbFailoverRuleRow {
  id: string;
  routeId: string | null;
  triggerType: string;
  action: string;
  priority: number;
  fromProviderId: string | null;
  toProviderId: string | null;
  enabled: boolean;
}

export function tierForHopIndex(index: number): FailoverTier {
  if (index === 0) return 'primary';
  if (index === 1) return 'secondary';
  if (index === 2) return 'tertiary';
  return 'fallback';
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 1,
};

export const DEFAULT_RETRY_BASE_MS = 250;
export const DEFAULT_MAX_RETRY_DELAY_MS = 8_000;
