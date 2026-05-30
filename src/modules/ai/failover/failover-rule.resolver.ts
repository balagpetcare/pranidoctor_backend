import type { DbFailoverRuleRow } from './failover.types.js';
import { isRetriableError, mapErrorToFailoverTrigger } from './failover.util.js';

export type FailoverDecision = 'retry' | 'next' | 'rules_only' | 'abort';

export class FailoverRuleResolver {
  readonly name = 'FailoverRuleResolver';

  resolve(params: {
    rules: DbFailoverRuleRow[];
    errorCode: string;
    statusCode?: number;
    fromProviderId: string;
    retriesRemaining: number;
  }): FailoverDecision {
    const trigger = mapErrorToFailoverTrigger(params.errorCode, params.statusCode);
    const matching = params.rules
      .filter((rule) => rule.enabled)
      .filter(
        (rule) => !rule.fromProviderId || rule.fromProviderId === params.fromProviderId,
      )
      .filter((rule) => trigger != null && rule.triggerType === trigger)
      .sort((a, b) => a.priority - b.priority);

    const rule = matching[0];
    if (!rule) {
      if (params.retriesRemaining > 0 && isRetriableError(params.errorCode)) {
        return 'retry';
      }
      return 'next';
    }

    switch (rule.action) {
      case 'RETRY_SAME':
        return params.retriesRemaining > 0 ? 'retry' : 'next';
      case 'NEXT_PROVIDER':
        return 'next';
      case 'RULES_ONLY':
        return 'rules_only';
      case 'ABORT':
        return 'abort';
      case 'DOWNGRADE_MODEL':
        return params.retriesRemaining > 0 ? 'retry' : 'next';
      default:
        return params.retriesRemaining > 0 && isRetriableError(params.errorCode)
          ? 'retry'
          : 'next';
    }
  }
}

let failoverRuleResolver: FailoverRuleResolver | null = null;

export function getFailoverRuleResolver(): FailoverRuleResolver {
  if (!failoverRuleResolver) failoverRuleResolver = new FailoverRuleResolver();
  return failoverRuleResolver;
}

export function resetFailoverRuleResolverForTests(): void {
  failoverRuleResolver = null;
}
