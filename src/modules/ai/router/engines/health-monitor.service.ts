import {
  getAIProviderMonitor,
  type AIProviderMonitor,
} from '../../failover/ai-provider-monitor.js';
import type { CircuitState, ProviderHealthSnapshot } from '../../failover/failover.types.js';

export type HealthSkipReason = 'circuit_open' | 'provider_disabled';

/** Router-facing health monitor — wraps circuit breaker + snapshots. */
export class RouterHealthMonitor {
  readonly name = 'RouterHealthMonitor';

  private get monitor(): AIProviderMonitor {
    return getAIProviderMonitor();
  }

  shouldAllowProvider(providerKey: string): boolean {
    return this.monitor.shouldAllowProvider(providerKey);
  }

  isProviderHealthy(providerKey: string): boolean {
    return this.monitor.isProviderHealthy(providerKey);
  }

  getCircuitState(providerKey: string): CircuitState {
    return this.monitor.getCircuitState(providerKey);
  }

  getSnapshot(providerKey: string): ProviderHealthSnapshot | undefined {
    return this.monitor.getSnapshot(providerKey);
  }

  getAllSnapshots(): ProviderHealthSnapshot[] {
    return this.monitor.getAllSnapshots();
  }

  recordSuccess(providerKey: string, latencyMs: number): void {
    this.monitor.recordSuccess(providerKey, latencyMs);
  }

  recordFailure(providerKey: string, latencyMs: number, errorCode?: string): void {
    this.monitor.recordFailure(providerKey, latencyMs, errorCode);
  }

  skipReason(providerKey: string): HealthSkipReason | null {
    if (providerKey === 'rules-based') return null;
    if (!this.shouldAllowProvider(providerKey)) return 'circuit_open';
    return null;
  }

  reset(providerKey?: string): void {
    this.monitor.reset(providerKey);
  }
}

let routerHealthMonitor: RouterHealthMonitor | null = null;

export function getRouterHealthMonitor(): RouterHealthMonitor {
  if (!routerHealthMonitor) routerHealthMonitor = new RouterHealthMonitor();
  return routerHealthMonitor;
}

export function resetRouterHealthMonitorForTests(): void {
  routerHealthMonitor?.reset();
  routerHealthMonitor = null;
}
