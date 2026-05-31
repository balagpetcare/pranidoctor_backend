import type { RouteHop } from '../../routing/ai-router.types.js';
import { withTimeout } from '../../failover/failover.util.js';

export type TimeoutEngineConfig = {
  minHopTimeoutMs: number;
};

const DEFAULT_CONFIG: TimeoutEngineConfig = {
  minHopTimeoutMs: 1_000,
};

/** Enforces per-hop and route-level timeouts. */
export class TimeoutEngine {
  readonly name = 'TimeoutEngine';

  constructor(private readonly config: TimeoutEngineConfig = DEFAULT_CONFIG) {}

  /** Remaining budget for a hop after prior hops consumed route time. */
  hopTimeoutMs(routeTimeoutMs: number, elapsedRouteMs: number): number {
    const remaining = routeTimeoutMs - elapsedRouteMs;
    return Math.max(this.config.minHopTimeoutMs, remaining);
  }

  async run<T>(operation: Promise<T>, timeoutMs: number, label?: string): Promise<T> {
    return withTimeout(operation, timeoutMs, label);
  }
}

let timeoutEngine: TimeoutEngine | null = null;

export function getTimeoutEngine(): TimeoutEngine {
  if (!timeoutEngine) timeoutEngine = new TimeoutEngine();
  return timeoutEngine;
}

export function resetTimeoutEngineForTests(): void {
  timeoutEngine = null;
}

export function hopTimeoutLabel(hop: RouteHop, tier: string): string {
  return `${hop.providerKey}:${tier}:${hop.modelKey}`;
}
