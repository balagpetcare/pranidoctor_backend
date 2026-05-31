import { getAiMetricsAggregatorService } from '../metrics/ai-metrics-aggregator.service.js';
import {
  getAiAnalyticsReconciliationRunService,
  persistReconciliationFailure,
} from '../metrics/ai-analytics-reconciliation-run.service.js';
import { utcDayStart } from '../usage/ai-usage-analytics.util.js';

export interface DailyMetricsJobResult {
  targetDate: string;
  result: Awaited<ReturnType<ReturnType<typeof getAiMetricsAggregatorService>['reconcileDailyMetrics']>>;
  driftDetected?: boolean;
}

/** Reconcile yesterday's daily rollups from AiUsageLog (idempotent). */
export async function runDailyMetricsJob(
  referenceDate: Date = new Date(),
): Promise<DailyMetricsJobResult> {
  const started = new Date();
  const yesterday = utcDayStart(referenceDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const bucketKey = yesterday.toISOString().slice(0, 10);

  try {
    const result = await getAiMetricsAggregatorService().reconcileDailyMetrics(yesterday);
    await getAiAnalyticsReconciliationRunService().recordRun({
      runType: 'daily',
      bucketKey,
      status: 'success',
      logCount: result.logCount,
      rollupsUpserted: result.dailyRollupsUpserted,
      durationMs: result.durationMs,
      startedAt: started,
    });
    return {
      targetDate: bucketKey,
      result,
      driftDetected: false,
    };
  } catch (error) {
    await persistReconciliationFailure('daily', bucketKey, error, started);
    throw error;
  }
}

/** Reconcile daily rollups for an explicit UTC date. */
export async function runDailyMetricsJobForDate(bucketDate: Date): Promise<DailyMetricsJobResult> {
  const started = new Date();
  const dayStart = utcDayStart(bucketDate);
  const bucketKey = dayStart.toISOString().slice(0, 10);

  try {
    const result = await getAiMetricsAggregatorService().reconcileDailyMetrics(dayStart);
    await getAiAnalyticsReconciliationRunService().recordRun({
      runType: 'daily',
      bucketKey,
      status: 'success',
      logCount: result.logCount,
      rollupsUpserted: result.dailyRollupsUpserted,
      durationMs: result.durationMs,
      startedAt: started,
      metadataJson: { source: 'manual' },
    });
    return {
      targetDate: bucketKey,
      result,
    };
  } catch (error) {
    await persistReconciliationFailure('daily', bucketKey, error, started);
    throw error;
  }
}
