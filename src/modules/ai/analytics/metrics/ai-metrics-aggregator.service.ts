import { getLogger } from '../../../../shared/logger/logger.js';
import {
  buildDailyRollupBuckets,
  buildMonthlyRollupBuckets,
  fetchUsageLogsForBucket,
  upsertDailyRollups,
  upsertMonthlyRollups,
} from './ai-analytics-source.util.js';
import { utcDayStart, utcMonthStart } from '../usage/ai-usage-analytics.util.js';

export interface MetricsAggregationResult {
  bucketDate?: string;
  bucketMonth?: string;
  logCount: number;
  dailyRollupsUpserted: number;
  monthlyRollupsUpserted: number;
  durationMs: number;
}

export class AiMetricsAggregatorService {
  readonly name = 'AiMetricsAggregatorService';

  /** Reconcile platform daily rollups from canonical AiUsageLog rows. */
  async reconcileDailyMetrics(bucketDate: Date = utcDayStart(new Date())): Promise<MetricsAggregationResult> {
    const started = Date.now();
    const dayStart = utcDayStart(bucketDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const logs = await fetchUsageLogsForBucket(dayStart, dayEnd);
    const buckets = buildDailyRollupBuckets(logs, dayStart);
    const dailyRollupsUpserted = await upsertDailyRollups(buckets);

    const result: MetricsAggregationResult = {
      bucketDate: dayStart.toISOString().slice(0, 10),
      logCount: logs.length,
      dailyRollupsUpserted,
      monthlyRollupsUpserted: 0,
      durationMs: Date.now() - started,
    };

    getLogger().info(result, 'AI daily metrics reconciliation completed');
    return result;
  }

  /** Reconcile monthly rollups (platform + org + branch dimensions) from AiUsageLog. */
  async reconcileMonthlyMetrics(
    bucketMonth: Date = utcMonthStart(new Date()),
  ): Promise<MetricsAggregationResult> {
    const started = Date.now();
    const monthStart = utcMonthStart(bucketMonth);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const logs = await fetchUsageLogsForBucket(monthStart, monthEnd);
    const buckets = buildMonthlyRollupBuckets(logs, monthStart);
    const monthlyRollupsUpserted = await upsertMonthlyRollups(buckets);

    const result: MetricsAggregationResult = {
      bucketMonth: monthStart.toISOString().slice(0, 7),
      logCount: logs.length,
      dailyRollupsUpserted: 0,
      monthlyRollupsUpserted,
      durationMs: Date.now() - started,
    };

    getLogger().info(result, 'AI monthly metrics reconciliation completed');
    return result;
  }

  /** Full reconciliation for a date range — daily buckets per UTC day. */
  async reconcileDailyRange(from: Date, to: Date): Promise<MetricsAggregationResult[]> {
    const results: MetricsAggregationResult[] = [];
    const cursor = utcDayStart(from);
    const end = utcDayStart(to);

    while (cursor <= end) {
      results.push(await this.reconcileDailyMetrics(new Date(cursor)));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return results;
  }
}

let service: AiMetricsAggregatorService | null = null;

export function getAiMetricsAggregatorService(): AiMetricsAggregatorService {
  if (!service) service = new AiMetricsAggregatorService();
  return service;
}

export function resetAiMetricsAggregatorServiceForTests(): void {
  service = null;
}
