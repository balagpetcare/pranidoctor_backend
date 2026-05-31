import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Job } from 'bullmq';

const scheduleRepeatingJob = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'job-1' }));
const createWorker = vi.hoisted(() => vi.fn().mockReturnValue({ close: vi.fn().mockResolvedValue(undefined) }));
const createQueue = vi.hoisted(() => vi.fn().mockReturnValue({}));

vi.mock('../../../../infra/queue/queue.service.js', () => ({
  scheduleRepeatingJob,
  createWorker,
  createQueue,
}));

const runDailyMetricsJob = vi.hoisted(() => vi.fn().mockResolvedValue({ targetDate: '2026-05-30' }));
const runMonthlyMetricsJob = vi.hoisted(() => vi.fn().mockResolvedValue({ targetMonth: '2026-05' }));
const runDailyValidationJob = vi.hoisted(() => vi.fn().mockResolvedValue({ withinTolerance: true }));

vi.mock('./ai-daily-metrics.job.js', () => ({ runDailyMetricsJob }));
vi.mock('./ai-monthly-metrics.job.js', () => ({ runMonthlyMetricsJob }));
vi.mock('../validation/ai-rollup-validation.service.js', () => ({
  getAiRollupValidationService: () => ({ runDailyValidationJob }),
}));

describe('AI analytics worker bootstrap', () => {
  beforeEach(() => {
    scheduleRepeatingJob.mockClear();
    createWorker.mockClear();
    createQueue.mockClear();
    runDailyMetricsJob.mockClear();
    runMonthlyMetricsJob.mockClear();
    runDailyValidationJob.mockClear();
    delete process.env.AI_ANALYTICS_CRON_ENABLED;
    delete process.env.AI_ANALYTICS_RECONCILE_ENABLED;
    delete process.env.AI_ANALYTICS_VALIDATE_ENABLED;
    process.env.NODE_ENV = 'production';
  });

  it('registers worker and three cron jobs in production', async () => {
    const { bootstrapAiAnalyticsWorkers } = await import('./ai-analytics-worker.bootstrap.js');
    await bootstrapAiAnalyticsWorkers({} as never);

    expect(createQueue).toHaveBeenCalledWith('ai:analytics');
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(scheduleRepeatingJob).toHaveBeenCalledTimes(3);
    expect(scheduleRepeatingJob).toHaveBeenCalledWith(
      'ai:analytics',
      'ai.analytics.reconcile.daily',
      { source: 'cron' },
      '5 2 * * *',
      { jobId: 'ai-analytics-daily-reconcile' },
    );
    expect(scheduleRepeatingJob).toHaveBeenCalledWith(
      'ai:analytics',
      'ai.analytics.validate.daily',
      { source: 'cron' },
      '30 2 * * *',
      { jobId: 'ai-analytics-daily-validate' },
    );
  });

  it('skips cron registration when AI_ANALYTICS_CRON_ENABLED=false', async () => {
    process.env.AI_ANALYTICS_CRON_ENABLED = 'false';
    const { bootstrapAiAnalyticsWorkers } = await import('./ai-analytics-worker.bootstrap.js');
    await bootstrapAiAnalyticsWorkers({} as never);

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(scheduleRepeatingJob).not.toHaveBeenCalled();
  });

  it('dispatches daily reconcile job', async () => {
    const { processAiAnalyticsScheduledJob } = await import('./ai-analytics-worker.bootstrap.js');
    const job = { id: '1', name: 'ai.analytics.reconcile.daily' } as Job;
    await processAiAnalyticsScheduledJob(job);
    expect(runDailyMetricsJob).toHaveBeenCalledTimes(1);
  });

  it('skips reconcile when AI_ANALYTICS_RECONCILE_ENABLED=false', async () => {
    process.env.AI_ANALYTICS_RECONCILE_ENABLED = 'false';
    const { processAiAnalyticsScheduledJob } = await import('./ai-analytics-worker.bootstrap.js');
    const job = { id: '2', name: 'ai.analytics.reconcile.daily' } as Job;
    const result = await processAiAnalyticsScheduledJob(job);
    expect(result).toEqual({ skipped: true });
    expect(runDailyMetricsJob).not.toHaveBeenCalled();
  });

  it('dispatches validate job after reconcile path', async () => {
    const { processAiAnalyticsScheduledJob } = await import('./ai-analytics-worker.bootstrap.js');
    const job = { id: '3', name: 'ai.analytics.validate.daily' } as Job;
    await processAiAnalyticsScheduledJob(job);
    expect(runDailyValidationJob).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown job names for queue recovery visibility', async () => {
    const { processAiAnalyticsScheduledJob } = await import('./ai-analytics-worker.bootstrap.js');
    const job = { id: '4', name: 'ai.analytics.unknown' } as Job;
    await expect(processAiAnalyticsScheduledJob(job)).rejects.toThrow('Unknown AI analytics job');
  });
});

describe('AI analytics env gates', () => {
  beforeEach(() => {
    delete process.env.AI_ANALYTICS_CRON_ENABLED;
    delete process.env.AI_USAGE_LEGACY_WRITE;
    process.env.NODE_ENV = 'test';
  });

  it('defaults legacy write to enabled', async () => {
    const { isAiUsageLegacyWriteEnabled } = await import('./ai-analytics-job.types.js');
    expect(isAiUsageLegacyWriteEnabled()).toBe(true);
  });

  it('disables legacy write when flag false', async () => {
    process.env.AI_USAGE_LEGACY_WRITE = 'false';
    const { isAiUsageLegacyWriteEnabled } = await import('./ai-analytics-job.types.js');
    expect(isAiUsageLegacyWriteEnabled()).toBe(false);
  });
});
