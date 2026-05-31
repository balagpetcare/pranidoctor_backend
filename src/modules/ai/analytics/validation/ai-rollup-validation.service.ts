import { getPrisma } from '../../../../shared/database/prisma.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import { getAiUsageAlertService } from '../../alerts/ai-usage-alert.service.js';
import {
  aggregateLogs,
  fetchUsageLogsForBucket,
} from '../metrics/ai-analytics-source.util.js';
import { getAiMetricsAggregatorService } from '../metrics/ai-metrics-aggregator.service.js';
import {
  getAiAnalyticsReconciliationRunService,
  persistReconciliationFailure,
} from '../metrics/ai-analytics-reconciliation-run.service.js';
import { decimalToNumber, roundUsd, utcDayStart } from '../usage/ai-usage-analytics.util.js';
import {
  ROLLUP_DRIFT_COST_TOLERANCE_USD,
  type RollupValidationResult,
} from './ai-rollup-validation.types.js';

export class AiRollupValidationService {
  readonly name = 'AiRollupValidationService';

  async validateDailyBucket(bucketDate: Date, options?: { autoRepair?: boolean }): Promise<RollupValidationResult> {
    const autoRepair = options?.autoRepair ?? true;
    let result = await this.compareDailyBucket(bucketDate);

    if (!result.withinTolerance && autoRepair) {
      getLogger().warn({ bucketDate: result.bucketDate }, 'AI rollup drift detected — attempting auto-repair');
      await getAiMetricsAggregatorService().reconcileDailyMetrics(utcDayStart(bucketDate));
      result = await this.compareDailyBucket(bucketDate);
      if (result.withinTolerance) {
        return { ...result, autoRepaired: true };
      }
    }

    return { ...result, autoRepaired: false };
  }

  async compareDailyBucket(bucketDate: Date): Promise<RollupValidationResult> {
    const dayStart = utcDayStart(bucketDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const logs = await fetchUsageLogsForBucket(dayStart, dayEnd);
    const logAgg = aggregateLogs(logs);

    const prisma = getPrisma();
    const rollupRows = await prisma.aiUsageDailyRollup.findMany({
      where: { bucketDate: dayStart },
    });

    let rollupRequests = 0;
    let rollupCostUsd = 0;
    let rollupTokens = 0;
    for (const row of rollupRows) {
      rollupRequests += row.requestCount;
      rollupCostUsd += decimalToNumber(row.costUsd);
      rollupTokens += row.totalTokens;
    }

    const logCostUsd = roundUsd(logAgg.costUsd);
    rollupCostUsd = roundUsd(rollupCostUsd);
    const driftRequests = logAgg.requests - rollupRequests;
    const driftCostUsd = roundUsd(logCostUsd - rollupCostUsd);

    const withinTolerance =
      Math.abs(driftCostUsd) <= ROLLUP_DRIFT_COST_TOLERANCE_USD && driftRequests === 0;

    return {
      bucketDate: dayStart.toISOString().slice(0, 10),
      logRequests: logAgg.requests,
      rollupRequests,
      logCostUsd,
      rollupCostUsd,
      logTokens: logAgg.totalTokens,
      rollupTokens,
      driftRequests,
      driftCostUsd,
      withinTolerance,
      autoRepaired: false,
    };
  }

  async runDailyValidationJob(referenceDate: Date = new Date()): Promise<RollupValidationResult> {
    const started = new Date();
    const yesterday = utcDayStart(referenceDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const bucketKey = yesterday.toISOString().slice(0, 10);

    try {
      const result = await this.validateDailyBucket(yesterday, { autoRepair: true });
      const status = result.withinTolerance ? 'success' : 'drift';

      await getAiAnalyticsReconciliationRunService().recordRun({
        runType: 'validate',
        bucketKey,
        status,
        logCount: result.logRequests,
        rollupsUpserted: result.rollupRequests,
        driftUsd: result.driftCostUsd,
        driftRequests: result.driftRequests,
        durationMs: Date.now() - started.getTime(),
        metadataJson: {
          autoRepaired: result.autoRepaired,
          logTokens: result.logTokens,
          rollupTokens: result.rollupTokens,
        },
        startedAt: started,
      });

      if (!result.withinTolerance) {
        await getAiUsageAlertService().emitAnalyticsReconcileDrift({
          bucketKey,
          ...result,
        });
      }

      return result;
    } catch (error) {
      await persistReconciliationFailure('validate', bucketKey, error, started);
      throw error;
    }
  }
}

let service: AiRollupValidationService | null = null;

export function getAiRollupValidationService(): AiRollupValidationService {
  if (!service) service = new AiRollupValidationService();
  return service;
}

export function resetAiRollupValidationServiceForTests(): void {
  service = null;
}
