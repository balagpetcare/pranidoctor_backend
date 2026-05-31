import { jsonError, jsonOk } from '@/lib/api-response';
import {
  actorContext,
  adminErrorMessage,
  parseJsonBody,
  requireAiSuperAdmin,
} from '../../../../../../../../modules/ai/admin/index.js';
import { runDailyMetricsJob, runDailyMetricsJobForDate } from '../../../../../../../../modules/ai/analytics/jobs/ai-daily-metrics.job.js';
import {
  runMonthlyMetricsJob,
  runMonthlyMetricsJobForMonth,
} from '../../../../../../../../modules/ai/analytics/jobs/ai-monthly-metrics.job.js';
import { runDailyRollupValidationJob } from '../../../../../../../../modules/ai/analytics/jobs/ai-daily-validation.job.js';
import { getAiRollupValidationService } from '../../../../../../../../modules/ai/analytics/validation/ai-rollup-validation.service.js';
import { utcDayStart, utcMonthStart } from '../../../../../../../../modules/ai/analytics/usage/ai-usage-analytics.util.js';
import { createAuditLogAsync } from '../../../../../../../../shared/security/audit/index.js';

type RunBody = {
  runType?: 'daily' | 'monthly' | 'validate';
  bucketDate?: string;
  bucketMonth?: string;
};

export async function POST(request: Request) {
  const auth = await requireAiSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: RunBody = {};
  try {
    body = await parseJsonBody<RunBody>(request);
  } catch {
    body = {};
  }

  const runType = body.runType ?? 'daily';

  try {
    let result: unknown;
    if (runType === 'monthly') {
      result = body.bucketMonth
        ? await runMonthlyMetricsJobForMonth(
            utcMonthStart(new Date(`${body.bucketMonth}-01T00:00:00.000Z`)),
          )
        : await runMonthlyMetricsJob();
    } else if (runType === 'validate') {
      result = body.bucketDate
        ? await getAiRollupValidationService().runDailyValidationJob(
            utcDayStart(new Date(`${body.bucketDate}T00:00:00.000Z`)),
          )
        : await runDailyRollupValidationJob();
    } else {
      result = body.bucketDate
        ? await runDailyMetricsJobForDate(utcDayStart(new Date(`${body.bucketDate}T00:00:00.000Z`)))
        : await runDailyMetricsJob();
    }

    void createAuditLogAsync({
      action: 'AI_ANALYTICS_RECONCILE_RUN',
      outcome: 'SUCCESS',
      ...actorContext(request, auth.actor),
      resourceType: 'ai_analytics_reconciliation',
      details: { runType, bucketDate: body.bucketDate, bucketMonth: body.bucketMonth },
    });

    return jsonOk({ runType, result });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to run reconciliation'), 500);
  }
}
