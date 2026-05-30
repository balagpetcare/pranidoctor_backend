import {
  recordProviderHealthMetric,
  setProviderUpMetric,
} from '../usage/ai-usage.metrics.js';
import { CircuitBreaker } from './circuit-breaker.js';
import type { CircuitBreakerConfig, CircuitState, ProviderHealthSnapshot } from './failover.types.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './failover.types.js';

export class AIProviderMonitor {
  readonly name = 'AIProviderMonitor';

  private readonly circuitBreaker: CircuitBreaker;
  private readonly snapshots = new Map<string, ProviderHealthSnapshot>();

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.circuitBreaker = new CircuitBreaker(config);
  }

  getCircuitState(providerKey: string): CircuitState {
    return this.circuitBreaker.getState(providerKey);
  }

  getConsecutiveFailures(providerKey: string): number {
    return this.circuitBreaker.getConsecutiveFailures(providerKey);
  }

  shouldAllowProvider(providerKey: string): boolean {
    if (providerKey === 'rules-based') return true;
    return this.circuitBreaker.allowRequest(providerKey);
  }

  recordSuccess(providerKey: string, latencyMs: number): void {
    this.circuitBreaker.recordSuccess(providerKey);
    setProviderUpMetric(providerKey, 1);
    recordProviderHealthMetric({ provider: providerKey, success: true, latencyMs });

    const existing = this.snapshots.get(providerKey);
    const now = new Date().toISOString();
    const snapshot: ProviderHealthSnapshot = {
      providerKey,
      configured: existing?.configured ?? true,
      reachable: true,
      latencyMs,
      circuitState: this.circuitBreaker.getState(providerKey),
      consecutiveFailures: 0,
      consecutiveSuccesses: (existing?.consecutiveSuccesses ?? 0) + 1,
      healthScore: 1,
      lastCheckedAt: now,
      lastSuccessAt: now,
    };
    if (existing?.lastFailureAt) snapshot.lastFailureAt = existing.lastFailureAt;
    this.snapshots.set(providerKey, snapshot);
  }

  recordFailure(providerKey: string, latencyMs: number, errorCode?: string): void {
    this.circuitBreaker.recordFailure(providerKey);
    setProviderUpMetric(providerKey, 0);
    const metric: Parameters<typeof recordProviderHealthMetric>[0] = {
      provider: providerKey,
      success: false,
      latencyMs,
    };
    if (errorCode) metric.errorCode = errorCode;
    recordProviderHealthMetric(metric);

    const existing = this.snapshots.get(providerKey);
    const now = new Date().toISOString();
    const consecutiveFailures = this.circuitBreaker.getConsecutiveFailures(providerKey);
    const snapshot: ProviderHealthSnapshot = {
      providerKey,
      configured: existing?.configured ?? true,
      reachable: false,
      latencyMs,
      circuitState: this.circuitBreaker.getState(providerKey),
      consecutiveFailures,
      consecutiveSuccesses: 0,
      healthScore: Math.max(0, 1 - consecutiveFailures * 0.15),
      lastCheckedAt: now,
      lastFailureAt: now,
    };
    if (errorCode) snapshot.errorCode = errorCode;
    if (existing?.lastSuccessAt) snapshot.lastSuccessAt = existing.lastSuccessAt;
    this.snapshots.set(providerKey, snapshot);
  }

  applyHealthSnapshot(snapshot: ProviderHealthSnapshot): void {
    const merged: ProviderHealthSnapshot = {
      ...snapshot,
      circuitState: this.circuitBreaker.getState(snapshot.providerKey),
      consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(snapshot.providerKey),
    };
    this.snapshots.set(snapshot.providerKey, merged);

    if (snapshot.reachable) {
      this.circuitBreaker.recordSuccess(snapshot.providerKey);
    } else if (snapshot.configured) {
      this.circuitBreaker.recordFailure(snapshot.providerKey);
    }
  }

  getSnapshot(providerKey: string): ProviderHealthSnapshot | undefined {
    const snapshot = this.snapshots.get(providerKey);
    if (!snapshot) return undefined;
    return {
      ...snapshot,
      circuitState: this.circuitBreaker.getState(providerKey),
      consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(providerKey),
    };
  }

  getAllSnapshots(): ProviderHealthSnapshot[] {
    return [...this.snapshots.values()].map((snapshot) => ({
      ...snapshot,
      circuitState: this.circuitBreaker.getState(snapshot.providerKey),
      consecutiveFailures: this.circuitBreaker.getConsecutiveFailures(snapshot.providerKey),
    }));
  }

  isProviderHealthy(providerKey: string): boolean {
    if (providerKey === 'rules-based') return true;
    if (!this.shouldAllowProvider(providerKey)) return false;
    const snapshot = this.snapshots.get(providerKey);
    if (!snapshot) return true;
    return snapshot.reachable !== false || snapshot.configured === false;
  }

  reset(providerKey?: string): void {
    if (providerKey) {
      this.snapshots.delete(providerKey);
      this.circuitBreaker.reset(providerKey);
      return;
    }
    this.snapshots.clear();
    this.circuitBreaker.reset();
  }
}

let aiProviderMonitor: AIProviderMonitor | null = null;

export function getAIProviderMonitor(): AIProviderMonitor {
  if (!aiProviderMonitor) {
    aiProviderMonitor = new AIProviderMonitor({
      failureThreshold: Number.parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD ?? '5', 10) || 5,
      resetTimeoutMs:
        Number.parseInt(process.env.AI_CIRCUIT_RESET_TIMEOUT_MS ?? '60000', 10) || 60_000,
      halfOpenSuccessThreshold: 1,
    });
  }
  return aiProviderMonitor;
}

export function resetAIProviderMonitorForTests(): void {
  aiProviderMonitor?.reset();
  aiProviderMonitor = null;
}
