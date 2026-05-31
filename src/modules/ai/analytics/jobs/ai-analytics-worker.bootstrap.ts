import type { Job } from 'bullmq';

import type { AppConfig } from '../../../../shared/config/index.js';
import {
  createWorker,
  createQueue,
  scheduleRepeatingJob,
} from '../../../../infra/queue/queue.service.js';
import { QueueNames } from '../../../../infra/queue/queue.types.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import { runDailyMetricsJob } from './ai-daily-metrics.job.js';
import { runMonthlyMetricsJob } from './ai-monthly-metrics.job.js';
import {
  AI_ANALYTICS_JOB_NAMES,
  type AiAnalyticsJobPayload,
  isAiAnalyticsCronEnabled,
  isAiAnalyticsReconcileEnabled,
  isAiAnalyticsValidateEnabled,
} from './ai-analytics-job.types.js';
import { getAiRollupValidationService } from '../validation/ai-rollup-validation.service.js';

export async function processAiAnalyticsScheduledJob(
  job: Job<AiAnalyticsJobPayload>,
): Promise<unknown> {
  switch (job.name) {
    case AI_ANALYTICS_JOB_NAMES.RECONCILE_DAILY:
      if (!isAiAnalyticsReconcileEnabled()) {
        getLogger().info({ jobId: job.id }, 'AI analytics daily reconcile skipped — disabled');
        return { skipped: true };
      }
      return runDailyMetricsJob();
    case AI_ANALYTICS_JOB_NAMES.RECONCILE_MONTHLY:
      if (!isAiAnalyticsReconcileEnabled()) {
        getLogger().info({ jobId: job.id }, 'AI analytics monthly reconcile skipped — disabled');
        return { skipped: true };
      }
      return runMonthlyMetricsJob();
    case AI_ANALYTICS_JOB_NAMES.VALIDATE_DAILY:
      if (!isAiAnalyticsValidateEnabled()) {
        getLogger().info({ jobId: job.id }, 'AI analytics daily validate skipped — disabled');
        return { skipped: true };
      }
      return getAiRollupValidationService().runDailyValidationJob();
    default:
      throw new Error(`Unknown AI analytics job: ${job.name}`);
  }
}

export async function bootstrapAiAnalyticsWorkers(_config: AppConfig): Promise<void> {
  createQueue(QueueNames.AI_ANALYTICS);
  createWorker<AiAnalyticsJobPayload, unknown>(
    QueueNames.AI_ANALYTICS,
    processAiAnalyticsScheduledJob,
  );
  getLogger().info({ msg: 'AI analytics worker registered', queue: QueueNames.AI_ANALYTICS });

  if (!isAiAnalyticsCronEnabled()) {
    getLogger().warn({ msg: 'AI analytics cron registration skipped — AI_ANALYTICS_CRON_ENABLED=false' });
    return;
  }

  await scheduleRepeatingJob(
    QueueNames.AI_ANALYTICS,
    AI_ANALYTICS_JOB_NAMES.RECONCILE_DAILY,
    { source: 'cron' },
    '5 2 * * *',
    { jobId: 'ai-analytics-daily-reconcile' },
  );

  await scheduleRepeatingJob(
    QueueNames.AI_ANALYTICS,
    AI_ANALYTICS_JOB_NAMES.VALIDATE_DAILY,
    { source: 'cron' },
    '30 2 * * *',
    { jobId: 'ai-analytics-daily-validate' },
  );

  await scheduleRepeatingJob(
    QueueNames.AI_ANALYTICS,
    AI_ANALYTICS_JOB_NAMES.RECONCILE_MONTHLY,
    { source: 'cron' },
    '15 3 1 * *',
    { jobId: 'ai-analytics-monthly-reconcile' },
  );

  getLogger().info({ msg: 'AI analytics cron jobs registered' });
}
