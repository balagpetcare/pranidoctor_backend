import { Counter, LatencyHistogram } from './prometheus-series.js';

const QUEUE_BUCKETS_SEC = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120];

const queueJobsTotal = new Counter();
const queueJobDuration = new LatencyHistogram(QUEUE_BUCKETS_SEC);

export type QueueJobMetricInput = {
  queue: string;
  jobName: string;
  outcome: 'completed' | 'failed';
  durationMs: number;
};

export function recordQueueJob(input: QueueJobMetricInput): void {
  queueJobsTotal.inc({
    queue: input.queue,
    job: input.jobName,
    outcome: input.outcome,
  });
  queueJobDuration.observe(
    { queue: input.queue, job: input.jobName, outcome: input.outcome },
    input.durationMs / 1000,
  );
}

export function renderQueuePrometheusLines(): string[] {
  return [
    ...queueJobsTotal.entries(
      'pranidoctor_queue_jobs_total',
      'Queue jobs processed by queue, job name, and outcome',
    ),
    ...queueJobDuration.entries(
      'pranidoctor_queue_job_duration_seconds',
      'Queue job processing duration in seconds',
    ),
  ];
}

export function resetQueueMetricsForTests(): void {
  queueJobsTotal.clear();
  queueJobDuration.clear();
}
