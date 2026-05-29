import { Queue, Worker, type Job, type ConnectionOptions, type JobsOptions } from 'bullmq';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { logInfo, logDebug, logWarn, logError } from '../../shared/logger/logger.js';
import { captureException } from '../../shared/monitoring/error-tracking.js';
import { recordQueueJob } from '../../shared/monitoring/metrics/queue.metrics.js';

import { queueDefinitions, defaultJobOptions } from './queue.config.js';
import type { QueueName } from './queue.types.js';

const queues: Map<string, Queue> = new Map();
const workers: Map<string, Worker> = new Map();

let connectionOptions: ConnectionOptions | null = null;
let queuePrefix: string = '';

export function initializeQueueConnection(config: AppConfig): ConnectionOptions {
  const redisUrl = new URL(config.redis.url);

  connectionOptions = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port) || 6379,
    maxRetriesPerRequest: null,
  };

  queuePrefix = `${config.redis.prefix}queue`;

  return connectionOptions;
}

export function getQueueConnection(): ConnectionOptions {
  if (!connectionOptions) {
    throw new Error('Queue connection not initialized. Call initializeQueueConnection first.');
  }
  return connectionOptions;
}

export function createQueue(name: QueueName): Queue {
  if (queues.has(name)) {
    return queues.get(name)!;
  }

  const connection = getQueueConnection();
  const definition = queueDefinitions[name];

  const queue = new Queue(name, {
    connection,
    prefix: queuePrefix,
    defaultJobOptions: definition?.defaultJobOptions ?? defaultJobOptions,
  });

  queue.on('error', (error) => {
    logError('Queue error', error, { queue: name });
  });

  queue.on('waiting', (job) => {
    logDebug('Job waiting', { queue: name, jobId: job.id });
  });

  queues.set(name, queue);
  logInfo('Queue created', { queue: name });

  return queue;
}

export type JobProcessor<T, R> = (job: Job<T>) => Promise<R>;

export function createWorker<T, R>(
  queueName: QueueName,
  processor: JobProcessor<T, R>
): Worker<T, R> {
  if (workers.has(queueName)) {
    logWarn('Worker already exists', { queue: queueName });
    return workers.get(queueName) as Worker<T, R>;
  }

  const connection = getQueueConnection();
  const definition = queueDefinitions[queueName];

  const wrappedProcessor = async (job: Job<T>): Promise<R> => {
    const startTime = Date.now();
    logInfo('Job started', {
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    });

    try {
      const result = await processor(job);
      const duration = Date.now() - startTime;

      logInfo('Job completed', {
        queue: queueName,
        jobId: job.id,
        duration,
      });

      recordQueueJob({
        queue: queueName,
        jobName: job.name,
        outcome: 'completed',
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logError('Job failed', error, {
        queue: queueName,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? 3,
        duration,
      });

      throw error;
    }
  };

  const worker = new Worker<T, R>(queueName, wrappedProcessor, {
    connection,
    prefix: queuePrefix,
    ...definition?.workerOptions,
  });

  worker.on('completed', (job, result) => {
    logDebug('Worker job completed', {
      queue: queueName,
      jobId: job.id,
      hasResult: result !== undefined,
    });
  });

  worker.on('failed', (job, error) => {
    const willRetry = job && job.attemptsMade < (job.opts.attempts ?? 3);

    if (willRetry) {
      logWarn('Job failed, will retry', {
        queue: queueName,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    } else {
      logError('Job permanently failed', error, {
        queue: queueName,
        jobId: job?.id,
        attempts: job?.attemptsMade,
      });
      const durationMs =
        job?.finishedOn != null && job?.processedOn != null
          ? job.finishedOn - job.processedOn
          : 0;
      recordQueueJob({
        queue: queueName,
        jobName: job?.name ?? 'unknown',
        outcome: 'failed',
        durationMs,
      });
      captureException(error, {
        source: 'background_job',
        queue: queueName,
        jobId: job?.id != null ? String(job.id) : undefined,
        jobName: job?.name,
        route: `queue:${queueName}`,
      });
    }
  });

  worker.on('error', (error) => {
    logError('Worker error', error, { queue: queueName });
    captureException(error, {
      source: 'background_worker',
      queue: queueName,
      route: `queue:${queueName}`,
    });
  });

  worker.on('stalled', (jobId) => {
    logWarn('Job stalled', { queue: queueName, jobId });
  });

  workers.set(queueName, worker);
  logInfo('Worker created', {
    queue: queueName,
    concurrency: definition?.workerOptions?.concurrency ?? 1,
  });

  return worker;
}

export interface AddJobOptions extends Partial<JobsOptions> {
  jobId?: string;
}

export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options?: AddJobOptions
): Promise<Job<T>> {
  const queue = createQueue(queueName);

  const job = await queue.add(jobName, data, {
    ...options,
    ...(options?.jobId && { jobId: options.jobId }),
  });

  logDebug('Job added', {
    queue: queueName,
    jobId: job.id,
    jobName,
  });

  return job;
}

export async function addBulkJobs<T>(
  queueName: QueueName,
  jobs: Array<{ name: string; data: T; opts?: AddJobOptions }>
): Promise<Job<T>[]> {
  const queue = createQueue(queueName);

  const addedJobs = await queue.addBulk(
    jobs.map((job) => ({
      name: job.name,
      data: job.data,
      ...(job.opts !== undefined ? { opts: job.opts } : {}),
    }))
  );

  logInfo('Bulk jobs added', {
    queue: queueName,
    count: addedJobs.length,
  });

  return addedJobs;
}

export async function scheduleJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  delay: number,
  options?: AddJobOptions
): Promise<Job<T>> {
  return addJob(queueName, jobName, data, {
    ...options,
    delay,
  });
}

export async function scheduleRepeatingJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  pattern: string,
  options?: AddJobOptions
): Promise<Job<T>> {
  return addJob(queueName, jobName, data, {
    ...options,
    repeat: {
      pattern,
    },
  });
}

export function getQueue(name: QueueName): Queue | undefined {
  return queues.get(name);
}

export function getWorker(name: QueueName): Worker | undefined {
  return workers.get(name);
}

export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueName);
  if (!queue) {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

export async function closeAllQueues(): Promise<void> {
  logInfo('Closing all queues and workers');

  const closePromises: Promise<void>[] = [];

  for (const [name, worker] of workers) {
    closePromises.push(
      worker.close().then(() => {
        logDebug('Worker closed', { queue: name });
      })
    );
  }

  await Promise.all(closePromises);
  workers.clear();

  const queueClosePromises: Promise<void>[] = [];

  for (const [name, queue] of queues) {
    queueClosePromises.push(
      queue.close().then(() => {
        logDebug('Queue closed', { queue: name });
      })
    );
  }

  await Promise.all(queueClosePromises);
  queues.clear();

  logInfo('All queues and workers closed');
}

export async function pauseQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.pause();
    logInfo('Queue paused', { queue: queueName });
  }
}

export async function resumeQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.resume();
    logInfo('Queue resumed', { queue: queueName });
  }
}

export async function drainQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  if (queue) {
    await queue.drain();
    logInfo('Queue drained', { queue: queueName });
  }
}
