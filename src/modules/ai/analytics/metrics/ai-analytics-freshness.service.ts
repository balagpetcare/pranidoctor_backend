import type { AnalyticsSummaryEnvelope } from '../metrics/ai-analytics-summary.types.js';
import { getAiAnalyticsReconciliationRunService } from '../metrics/ai-analytics-reconciliation-run.service.js';

export interface AnalyticsFreshnessMetadata {
  lastDailyReconcileAt: string | null;
  lastValidateAt: string | null;
  lagSeconds: number | null;
}

export async function getAnalyticsFreshnessMetadata(): Promise<AnalyticsFreshnessMetadata> {
  const runService = getAiAnalyticsReconciliationRunService();
  const [daily, validate] = await Promise.all([
    runService.getLastRun('daily'),
    runService.getLastRun('validate'),
  ]);

  const lastDailyReconcileAt = daily?.completedAt ?? daily?.startedAt ?? null;
  const lastValidateAt = validate?.completedAt ?? validate?.startedAt ?? null;
  const reference = lastValidateAt ?? lastDailyReconcileAt;
  const lagSeconds = reference
    ? Math.max(0, Math.floor((Date.now() - new Date(reference).getTime()) / 1000))
    : null;

  return {
    lastDailyReconcileAt,
    lastValidateAt,
    lagSeconds,
  };
}

export async function withAnalyticsFreshness<T>(
  envelope: AnalyticsSummaryEnvelope<T>,
): Promise<AnalyticsSummaryEnvelope<T>> {
  const freshness = await getAnalyticsFreshnessMetadata();
  return { ...envelope, freshness };
}
