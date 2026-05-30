import { classifyProviderError } from '../usage/ai-usage.errors.js';

/** Maps runtime error codes to DB `AiFailoverTriggerType` values. */
export function mapErrorToFailoverTrigger(
  errorCode: string,
  statusCode?: number,
): string | null {
  switch (errorCode) {
    case 'rate_limit':
      return 'HTTP_429';
    case 'provider_5xx':
      return 'HTTP_5XX';
    case 'timeout':
      return 'TIMEOUT';
    case 'not_configured':
      return 'PROVIDER_DISABLED';
    case 'auth':
      return 'PROVIDER_DISABLED';
    case 'budget_exceeded':
      return 'BUDGET_EXCEEDED';
    default:
      break;
  }

  if (statusCode === 429) return 'HTTP_429';
  if (statusCode != null && statusCode >= 500) return 'HTTP_5XX';
  return null;
}

export function classifyExecutionError(err: unknown): { errorCode: string; statusCode?: number } {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes('budget')) {
    return { errorCode: 'budget_exceeded' };
  }

  const errorCode = classifyProviderError(err);
  let statusCode: number | undefined;

  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') statusCode = code;
  }

  const match = message.match(/error (\d{3})/i);
  if (!statusCode && match?.[1]) {
    statusCode = Number.parseInt(match[1], 10);
  }

  return statusCode != null ? { errorCode, statusCode } : { errorCode };
}

export function isRetriableError(errorCode: string): boolean {
  return ['timeout', 'rate_limit', 'provider_5xx', 'provider_error'].includes(errorCode);
}

export function retryDelayMs(attempt: number, baseMs = 250, maxMs = 8_000): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`timeout after ${timeoutMs}ms${label ? `: ${label}` : ''}`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
