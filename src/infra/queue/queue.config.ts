import type { JobsOptions, WorkerOptions } from 'bullmq';

import { QueueNames } from './queue.types.js';

export interface QueueDefinition {
  name: string;
  defaultJobOptions: JobsOptions;
  workerOptions: Partial<WorkerOptions>;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 86400,
    count: 5000,
  },
};

export const queueDefinitions: Record<string, QueueDefinition> = {
  [QueueNames.NOTIFICATION]: {
    name: QueueNames.NOTIFICATION,
    defaultJobOptions: {
      ...defaultJobOptions,
      priority: 1,
    },
    workerOptions: {
      concurrency: 10,
    },
  },

  [QueueNames.SMS]: {
    name: QueueNames.SMS,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      priority: 1,
    },
    workerOptions: {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60000,
      },
    },
  },

  [QueueNames.EMAIL]: {
    name: QueueNames.EMAIL,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 5,
      priority: 2,
    },
    workerOptions: {
      concurrency: 10,
    },
  },

  [QueueNames.PUSH]: {
    name: QueueNames.PUSH,
    defaultJobOptions: {
      ...defaultJobOptions,
      priority: 1,
    },
    workerOptions: {
      concurrency: 20,
    },
  },

  [QueueNames.AI_COMPLETION]: {
    name: QueueNames.AI_COMPLETION,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    },
    workerOptions: {
      concurrency: 5,
    },
  },

  [QueueNames.AI_EMBEDDING]: {
    name: QueueNames.AI_EMBEDDING,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 3,
    },
    workerOptions: {
      concurrency: 10,
    },
  },

  [QueueNames.AI_SUMMARY]: {
    name: QueueNames.AI_SUMMARY,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2,
    },
    workerOptions: {
      concurrency: 3,
    },
  },

  [QueueNames.REPORT]: {
    name: QueueNames.REPORT,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2,
      priority: 5,
    },
    workerOptions: {
      concurrency: 2,
    },
  },

  [QueueNames.EXPORT]: {
    name: QueueNames.EXPORT,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 2,
      priority: 5,
    },
    workerOptions: {
      concurrency: 2,
    },
  },

  [QueueNames.CLEANUP]: {
    name: QueueNames.CLEANUP,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1,
      priority: 10,
    },
    workerOptions: {
      concurrency: 1,
    },
  },

  [QueueNames.BACKUP]: {
    name: QueueNames.BACKUP,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 3,
      priority: 10,
    },
    workerOptions: {
      concurrency: 1,
    },
  },

  [QueueNames.SCHEDULED]: {
    name: QueueNames.SCHEDULED,
    defaultJobOptions: {
      ...defaultJobOptions,
      priority: 5,
    },
    workerOptions: {
      concurrency: 5,
    },
  },
};
