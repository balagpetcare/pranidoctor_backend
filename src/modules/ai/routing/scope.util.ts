export const PLATFORM_SCOPE_KEY = 'platform';

export function buildScopeKey(tenantId?: string | null, branchId?: string | null): string {
  if (tenantId && branchId) return `tenant:${tenantId}:branch:${branchId}`;
  if (tenantId) return `tenant:${tenantId}`;
  return PLATFORM_SCOPE_KEY;
}

/** Branch → tenant → platform (most specific first). */
export function scopeKeysForResolution(
  tenantId?: string | null,
  branchId?: string | null,
): string[] {
  const keys: string[] = [];
  if (tenantId && branchId) keys.push(buildScopeKey(tenantId, branchId));
  if (tenantId) keys.push(buildScopeKey(tenantId, null));
  keys.push(PLATFORM_SCOPE_KEY);
  return keys;
}
