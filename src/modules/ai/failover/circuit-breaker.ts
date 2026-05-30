import type { CircuitBreakerConfig, CircuitState } from './failover.types.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './failover.types.js';

interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  openedAt: number | null;
}

export class CircuitBreaker {
  private readonly states = new Map<string, CircuitBreakerState>();

  constructor(private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {}

  getState(providerKey: string): CircuitState {
    return this.getOrCreate(providerKey).state;
  }

  getConsecutiveFailures(providerKey: string): number {
    return this.getOrCreate(providerKey).consecutiveFailures;
  }

  allowRequest(providerKey: string, now = Date.now()): boolean {
    const entry = this.getOrCreate(providerKey);
    if (entry.state === 'closed') return true;

    if (entry.state === 'open') {
      if (entry.openedAt != null && now - entry.openedAt >= this.config.resetTimeoutMs) {
        entry.state = 'half_open';
        entry.consecutiveSuccesses = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(providerKey: string): void {
    const entry = this.getOrCreate(providerKey);
    entry.consecutiveFailures = 0;
    entry.consecutiveSuccesses += 1;

    if (entry.state === 'half_open') {
      if (entry.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        entry.state = 'closed';
        entry.openedAt = null;
        entry.consecutiveSuccesses = 0;
      }
      return;
    }

    entry.state = 'closed';
    entry.openedAt = null;
  }

  recordFailure(providerKey: string, now = Date.now()): void {
    const entry = this.getOrCreate(providerKey);
    entry.consecutiveFailures += 1;
    entry.consecutiveSuccesses = 0;

    if (entry.state === 'half_open') {
      entry.state = 'open';
      entry.openedAt = now;
      return;
    }

    if (entry.consecutiveFailures >= this.config.failureThreshold) {
      entry.state = 'open';
      entry.openedAt = now;
    }
  }

  reset(providerKey?: string): void {
    if (providerKey) {
      this.states.delete(providerKey);
      return;
    }
    this.states.clear();
  }

  private getOrCreate(providerKey: string): CircuitBreakerState {
    let entry = this.states.get(providerKey);
    if (!entry) {
      entry = {
        state: 'closed',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        openedAt: null,
      };
      this.states.set(providerKey, entry);
    }
    return entry;
  }
}
