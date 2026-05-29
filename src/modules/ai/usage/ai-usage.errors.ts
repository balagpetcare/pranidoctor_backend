/** Classify provider errors for monitoring dashboards and alerts. */
export function classifyProviderError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('429') || lower.includes('rate limit')) return 'rate_limit';
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
    return 'auth';
  }
  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('econnreset')) {
    return 'timeout';
  }
  if (/error 5\d\d/.test(lower) || lower.includes('502') || lower.includes('503')) {
    return 'provider_5xx';
  }
  if (lower.includes('not configured')) return 'not_configured';
  return 'provider_error';
}
