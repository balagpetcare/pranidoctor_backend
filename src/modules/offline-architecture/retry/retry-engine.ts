import {
  OFFLINE_MAX_RETRY_ATTEMPTS,
  OFFLINE_RETRY_BASE_MS,
  OFFLINE_RETRY_MAX_MS,
} from '../offline-architecture.types.js';

export function computeNextRetryAt(attemptCount: number, now = Date.now()): Date {
  const delayMs = Math.min(
    OFFLINE_RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1),
    OFFLINE_RETRY_MAX_MS,
  );
  return new Date(now + delayMs);
}

export function shouldMoveToDeadQueue(attemptCount: number, maxAttempts = OFFLINE_MAX_RETRY_ATTEMPTS): boolean {
  return attemptCount >= maxAttempts;
}

export function isEligibleForRetry(
  status: string,
  nextRetryAt: Date | null,
  now = Date.now(),
): boolean {
  if (status === 'DEAD') return false;
  if (status !== 'FAILED' && status !== 'CONFLICT') return false;
  if (!nextRetryAt) return true;
  return nextRetryAt.getTime() <= now;
}
