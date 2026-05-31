export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    timeout?: number;
  };
}

export const QueueNames = {
  NOTIFICATION: 'notification',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  AI_COMPLETION: 'ai:completion',
  AI_EMBEDDING: 'ai:embedding',
  AI_SUMMARY: 'ai:summary',
  REPORT: 'report',
  EXPORT: 'export',
  CLEANUP: 'cleanup',
  BACKUP: 'backup',
  SCHEDULED: 'scheduled',
  AI_ANALYTICS: 'ai:analytics',
  KNOWLEDGE_IMPORT: 'knowledge:import',
  KNOWLEDGE_VALIDATE: 'knowledge:validate',
  KNOWLEDGE_EMBEDDING: 'ai:knowledge:embed',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
