import { jsonError } from '../../../../legacy/web/lib/api-response.js';
import { checkRateLimit } from '../../../../shared/security/rate-limit/rate-limit.service.js';
import { RateLimitPresets } from '../../../../shared/security/rate-limit/rate-limit.config.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { parseScopedAnalyticsFilters } from '../../admin/ai-admin-route.util.js';
import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';
import { createAuditLogAsync } from '../../../../shared/security/audit/index.js';

export async function enforceAiAnalyticsRateLimit(actor: AiAdminActor): Promise<Response | null> {
  const result = await checkRateLimit(`admin:${actor.id}`, RateLimitPresets.AI_ANALYTICS);
  if (!result.allowed) {
    return jsonError('RATE_LIMIT_EXCEEDED', 'Too many analytics requests, please try again later', 429);
  }
  return null;
}

/** Rate limit + scope guard — returns 403/429 Response or scoped filters. */
export async function requireScopedAnalyticsAccess(
  request: Request,
  actor: AiAdminActor,
): Promise<UsageAnalyticsFilters | Response> {
  const rateLimited = await enforceAiAnalyticsRateLimit(actor);
  if (rateLimited) return rateLimited;
  return parseScopedAnalyticsFilters(request, actor);
}

export async function auditAnalyticsExport(
  actor: AiAdminActor,
  filters: UsageAnalyticsFilters,
  format: string,
  rowCount: number,
): Promise<void> {
  void createAuditLogAsync({
    action: 'AI_ANALYTICS_EXPORT',
    severity: 'WARNING',
    outcome: 'SUCCESS',
    actorId: actor.id,
    actorRole: actor.role,
    resourceType: 'ai_analytics_export',
    details: {
      format,
      rowCount,
      organizationId: filters.organizationId,
      branchId: filters.branchId,
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
    },
  });
}
