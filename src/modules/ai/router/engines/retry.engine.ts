import {
  isRetriableError,
  retryDelayMs,
  sleep,
} from '../../failover/failover.util.js';
import {
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_RETRY_BASE_MS,
} from '../../failover/failover.types.js';

export type RetryEngineConfig = {
  baseMs: number;
  maxMs: number;
};

const DEFAULT_CONFIG: RetryEngineConfig = {
  baseMs: DEFAULT_RETRY_BASE_MS,
  maxMs: DEFAULT_MAX_RETRY_DELAY_MS,
};

/** Retry scheduling and retriability checks. */
export class RetryEngine {
  readonly name = 'RetryEngine';

  constructor(private readonly config: RetryEngineConfig = DEFAULT_CONFIG) {}

  isRetriable(errorCode: string): boolean {
    return isRetriableError(errorCode);
  }

  canRetrySameHop(errorCode: string, retriesRemaining: number): boolean {
    if (errorCode === 'timeout') return false;
    return retriesRemaining > 0 && this.isRetriable(errorCode);
  }

  /** Exponential backoff with optional Retry-After cap (milliseconds). */
  delayMs(attemptIndex: number, retryAfterMs?: number): number {
    const backoff = retryDelayMs(attemptIndex, this.config.baseMs, this.config.maxMs);
    if (retryAfterMs != null && retryAfterMs > 0) {
      return Math.min(retryAfterMs, this.config.maxMs);
    }
    return backoff;
  }

  async wait(attemptIndex: number, retryAfterMs?: number): Promise<void> {
    await sleep(this.delayMs(attemptIndex, retryAfterMs));
  }

  parseRetryAfterHeader(retryAfter: string | null | undefined): number | undefined {
    if (!retryAfter?.trim()) return undefined;
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000;
    }
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      return Math.max(0, dateMs - Date.now());
    }
    return undefined;
  }
}

let retryEngine: RetryEngine | null = null;

export function getRetryEngine(): RetryEngine {
  if (!retryEngine) retryEngine = new RetryEngine();
  return retryEngine;
}

export function resetRetryEngineForTests(): void {
  retryEngine = null;
}
