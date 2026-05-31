import { getAiMetricsAggregatorService } from '../metrics/ai-metrics-aggregator.service.js';
import {
  getAiAnalyticsReconciliationRunService,
  persistReconciliationFailure,
} from '../metrics/ai-analytics-reconciliation-run.service.js';
import { utcMonthStart } from '../usage/ai-usage-analytics.util.js';

export interface MonthlyMetricsJobResult {
  targetMonth: string;
  result: Awaited<ReturnType<ReturnType<typeof getAiMetricsAggregatorService>['reconcileMonthlyMetrics']>>;
}

/** Reconcile previous calendar month's rollups from AiUsageLog (idempotent). */
export async function runMonthlyMetricsJob(
  referenceDate: Date = new Date(),
): Promise<MonthlyMetricsJobResult> {
  const started = new Date();
  const previousMonth = utcMonthStart(referenceDate);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const bucketKey = previousMonth.toISOString().slice(0, 7);

  try {
    const result = await getAiMetricsAggregatorService().reconcileMonthlyMetrics(previousMonth);
    await getAiAnalyticsReconciliationRunService().recordRun({
      runType: 'monthly',
      bucketKey,
      status: 'success',
      logCount: result.logCount,
      rollupsUpserted: result.monthlyRollupsUpserted,
      durationMs: result.durationMs,
      startedAt: started,
    });
    return {
      targetMonth: bucketKey,
      result,
    };
  } catch (error) {
    await persistReconciliationFailure('monthly', bucketKey, error, started);
    throw error;
  }
}

/** Reconcile monthly rollups for an explicit UTC month. */
export async function runMonthlyMetricsJobForMonth(
  bucketMonth: Date,
): Promise<MonthlyMetricsJobResult> {
  const started = new Date();
  const month = utcMonthStart(bucketMonth);
  const bucketKey = month.toISOString().slice(0, 7);

  try {
    const result = await getAiMetricsAggregatorService().reconcileMonthlyMetrics(month);
    await getAiAnalyticsReconciliationRunService().recordRun({
      runType: 'monthly',
      bucketKey,
      status: 'success',
      logCount: result.logCount,
      rollupsUpserted: result.monthlyRollupsUpserted,
      durationMs: result.durationMs,
      startedAt: started,
      metadataJson: { source: 'manual' },
    });
    return {
      targetMonth: bucketKey,
      result,
    };
  } catch (error) {
    await persistReconciliationFailure('monthly', bucketKey, error, started);
    throw error;
  }
}
