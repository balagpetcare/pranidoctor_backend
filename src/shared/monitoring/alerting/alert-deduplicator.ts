import type { AlertSeverity } from './alert-types.js';

export type DedupDecision = {
  allow: boolean;
  repeatCount: number;
  escalated: boolean;
  escalationLevel: number;
  deduplicated: boolean;
  stormSuppressed?: boolean;
};

type DedupEntry = {
  repeatCount: number;
  lastSentAt: number | null;
};

type StormBucket = {
  windowStart: number;
  count: number;
};

/**
 * In-memory deduplication and storm prevention for production alerts.
 * Safe for single-process Node; resets on deploy/restart.
 */
export class AlertDeduplicator {
  private readonly entries = new Map<string, DedupEntry>();
  private readonly stormBuckets = new Map<AlertSeverity, StormBucket>();

  constructor(
    private readonly dedupWindowMs: number,
    private readonly escalationThreshold: number,
    private readonly stormLimitFor: (severity: AlertSeverity) => number,
  ) {}

  evaluate(key: string, severity: AlertSeverity): DedupDecision {
    const now = Date.now();
    const entry = this.entries.get(key) ?? { repeatCount: 0, lastSentAt: null };
    entry.repeatCount += 1;

    const withinWindow =
      entry.lastSentAt != null && now - entry.lastSentAt < this.dedupWindowMs;
    const escalationLevel =
      entry.repeatCount >= this.escalationThreshold
        ? Math.floor(entry.repeatCount / this.escalationThreshold)
        : 0;
    const shouldEscalate =
      entry.repeatCount >= this.escalationThreshold &&
      entry.repeatCount % this.escalationThreshold === 0;

    if (withinWindow && !shouldEscalate) {
      this.entries.set(key, entry);
      return {
        allow: false,
        repeatCount: entry.repeatCount,
        escalated: false,
        escalationLevel,
        deduplicated: true,
      };
    }

    if (!this.allowStorm(severity, now)) {
      this.entries.set(key, entry);
      return {
        allow: false,
        repeatCount: entry.repeatCount,
        escalated: escalationLevel > 0,
        escalationLevel,
        deduplicated: false,
        stormSuppressed: true,
      };
    }

    entry.lastSentAt = now;
    this.entries.set(key, entry);
    this.recordStorm(severity, now);

    return {
      allow: true,
      repeatCount: entry.repeatCount,
      escalated: escalationLevel > 0,
      escalationLevel,
      deduplicated: false,
    };
  }

  reset(): void {
    this.entries.clear();
    this.stormBuckets.clear();
  }

  private allowStorm(severity: AlertSeverity, now: number): boolean {
    const bucket = this.stormBuckets.get(severity);
    if (!bucket || now - bucket.windowStart >= 60_000) {
      return true;
    }
    return bucket.count < this.stormLimitFor(severity);
  }

  private recordStorm(severity: AlertSeverity, now: number): void {
    const existing = this.stormBuckets.get(severity);
    if (!existing || now - existing.windowStart >= 60_000) {
      this.stormBuckets.set(severity, { windowStart: now, count: 1 });
      return;
    }
    existing.count += 1;
  }
}
