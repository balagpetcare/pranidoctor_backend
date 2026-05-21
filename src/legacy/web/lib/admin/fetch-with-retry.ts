function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchWithRetryOptions = Readonly<{
  retries?: number;
  baseDelayMs?: number;
  /** Called before each retry (attempt is 1-based after first failure) */
  onRetry?: (attempt: number, error: unknown) => void;
}>;

/**
 * Retries transient failures for short admin bootstrap calls (network blips).
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: FetchWithRetryOptions): Promise<T> {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt >= retries) break;
      options?.onRetry?.(attempt + 1, e);
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw last;
}
