import { omitUndefined } from '../../../shared/types/object.utils.js';
import { parseAnalyticsDateRange } from '../analytics/usage/ai-usage-analytics.util.js';
import type { UsageAnalyticsFilters } from '../analytics/usage/ai-usage-analytics.types.js';
import type { AiAdminActor } from './ai-admin.guard.js';
import {
  getAiUsageScopeGuard,
  scopeGuardFailureToResponse,
} from '../analytics/security/ai-usage-scope.guard.js';

export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error('Request body must be JSON');
  }
}

export function parseAnalyticsFiltersFromRequest(request: Request): UsageAnalyticsFilters {
  const url = new URL(request.url);
  const rangeInput: { from?: string; to?: string; sinceDays?: number } = {};
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const sinceDays = url.searchParams.get('sinceDays');
  if (from) rangeInput.from = from;
  if (to) rangeInput.to = to;
  if (sinceDays) rangeInput.sinceDays = Number(sinceDays);
  const { from: fromDate, to: toDate } = parseAnalyticsDateRange(rangeInput);
  return omitUndefined({
    from: fromDate,
    to: toDate,
    branchId: url.searchParams.get('branchId') ?? undefined,
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    feature: url.searchParams.get('feature') ?? undefined,
    provider: url.searchParams.get('provider') ?? undefined,
    taskType: url.searchParams.get('taskType') ?? undefined,
  });
}

/** Parse analytics filters with tenant scope enforcement — returns 403 Response on violation. */
export async function parseScopedAnalyticsFilters(
  request: Request,
  actor: AiAdminActor,
): Promise<UsageAnalyticsFilters | Response> {
  const raw = parseAnalyticsFiltersFromRequest(request);
  const route = new URL(request.url).pathname;
  const result = await getAiUsageScopeGuard().enforce(actor, raw, { route });
  if (!result.ok) return scopeGuardFailureToResponse(result);
  return result.filters;
}

export function adminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
