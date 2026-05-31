import type { FailoverDecision } from '../../failover/failover-rule.resolver.js';
import {
  getFailoverRuleResolver,
  type FailoverRuleResolver,
} from '../../failover/failover-rule.resolver.js';
import type { DbFailoverRuleRow } from '../../failover/failover.types.js';
import { isRetriableError, mapErrorToFailoverTrigger } from '../../failover/failover.util.js';

export type FallbackDecisionInput = {
  rules: DbFailoverRuleRow[];
  errorCode: string;
  statusCode?: number;
  fromProviderId: string;
  retriesRemaining: number;
};

/** Maps errors and DB failover rules to routing decisions. */
export class FallbackEngine {
  readonly name = 'FallbackEngine';

  constructor(private readonly ruleResolver: FailoverRuleResolver = getFailoverRuleResolver()) {}

  decide(input: FallbackDecisionInput): FailoverDecision {
    return this.ruleResolver.resolve(input);
  }

  mapTrigger(errorCode: string, statusCode?: number): string | null {
    return mapErrorToFailoverTrigger(errorCode, statusCode);
  }

  defaultDecision(errorCode: string, retriesRemaining: number): FailoverDecision {
    if (retriesRemaining > 0 && isRetriableError(errorCode)) {
      return 'retry';
    }
    return 'next';
  }
}

let fallbackEngine: FallbackEngine | null = null;

export function getFallbackEngine(): FallbackEngine {
  if (!fallbackEngine) fallbackEngine = new FallbackEngine();
  return fallbackEngine;
}

export function resetFallbackEngineForTests(): void {
  fallbackEngine = null;
}
