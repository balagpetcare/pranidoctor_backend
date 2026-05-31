import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { getAiUsageAnalyticsService } from '../../../../../../../../modules/ai/analytics/usage/ai-usage-analytics.service.js';
import { requireScopedAnalyticsAccess } from '../../../../../../../../modules/ai/analytics/security/ai-analytics-access.util.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.analytics.view');
  if (!auth.ok) return auth.response;
  try {
    const filters = await requireScopedAnalyticsAccess(request, auth.actor);
    if (filters instanceof Response) return filters;
    const monthlyCost = await getAiUsageAnalyticsService().getMonthlyCost(filters);
    return jsonOk({ range: filters, monthlyCost });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load monthly cost'), 500);
  }
}
