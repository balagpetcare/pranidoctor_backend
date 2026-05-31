import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { withAnalyticsFreshness } from '../../../../../../../../modules/ai/analytics/metrics/ai-analytics-freshness.service.js';
import { getAiModelAnalyticsService } from '../../../../../../../../modules/ai/analytics/metrics/index.js';
import { requireScopedAnalyticsAccess } from '../../../../../../../../modules/ai/analytics/security/ai-analytics-access.util.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.analytics.view');
  if (!auth.ok) return auth.response;
  try {
    const filters = await requireScopedAnalyticsAccess(request, auth.actor);
    if (filters instanceof Response) return filters;
    const data = await withAnalyticsFreshness(
      await getAiModelAnalyticsService().getModelSummary(filters),
    );
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load model summary'), 500);
  }
}
