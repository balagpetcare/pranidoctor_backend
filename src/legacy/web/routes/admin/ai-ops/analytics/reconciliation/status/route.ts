import { jsonError, jsonOk } from '@/lib/api-response';
import { adminErrorMessage, requireAiSuperAdmin } from '../../../../../../../../modules/ai/admin/index.js';
import { getAiAnalyticsReconciliationRunService } from '../../../../../../../../modules/ai/analytics/metrics/ai-analytics-reconciliation-run.service.js';

export async function GET() {
  const auth = await requireAiSuperAdmin();
  if (!auth.ok) return auth.response;
  try {
    const service = getAiAnalyticsReconciliationRunService();
    const [daily, validate, monthly, recent] = await Promise.all([
      service.getLastRun('daily'),
      service.getLastRun('validate'),
      service.getLastRun('monthly'),
      service.listRecentRuns(10),
    ]);
    return jsonOk({
      lastDaily: daily,
      lastValidate: validate,
      lastMonthly: monthly,
      recentRuns: recent,
    });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load reconciliation status'), 500);
  }
}
