import { Counter, Gauge, LatencyHistogram } from './prometheus-series.js';

const QUEUE_BUCKETS_SEC = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120];

const queueJobsTotal = new Counter();
const queueJobDuration = new LatencyHistogram(QUEUE_BUCKETS_SEC);
const queueWaiting = new Gauge();
const queueActive = new Gauge();
const queueFailed = new Gauge();
const queueHealthy = new Gauge();

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

export type QueueDepthInput = {
  waiting: number;
  active: number;
  failed: number;
};

export function recordQueueDepth(queue: string, stats: QueueDepthInput): void {
  queueWaiting.set({ queue }, stats.waiting);
  queueActive.set({ queue }, stats.active);
  queueFailed.set({ queue }, stats.failed);
}

export function recordQueueHealthProbe(input: { healthy: boolean; waitingTotal: number }): void {
  queueHealthy.setUnlabeled(input.healthy ? 1 : 0);
  queueWaiting.set({ queue: '_total' }, input.waitingTotal);
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
    ...queueWaiting.entries('pranidoctor_queue_waiting_jobs', 'Jobs waiting in queue'),
    ...queueActive.entries('pranidoctor_queue_active_jobs', 'Jobs currently active'),
    ...queueFailed.entries('pranidoctor_queue_failed_jobs', 'Jobs in failed state'),
    ...queueHealthy.entries('pranidoctor_queue_up', 'Queue subsystem health (1=healthy, 0=unhealthy)'),
  ];
}

export function resetQueueMetricsForTests(): void {
  queueJobsTotal.clear();
  queueJobDuration.clear();
  queueWaiting.clear();
  queueActive.clear();
  queueFailed.clear();
  queueHealthy.clear();
}
