export const AI_ANALYTICS_JOB_NAMES = {
  RECONCILE_DAILY: 'ai.analytics.reconcile.daily',
  RECONCILE_MONTHLY: 'ai.analytics.reconcile.monthly',
  VALIDATE_DAILY: 'ai.analytics.validate.daily',
} as const;

export type AiAnalyticsJobName = (typeof AI_ANALYTICS_JOB_NAMES)[keyof typeof AI_ANALYTICS_JOB_NAMES];

export interface AiAnalyticsJobPayload {
  source?: 'cron' | 'manual' | 'ops-script';
  bucketDate?: string;
  bucketMonth?: string;
}

export function isAiAnalyticsCronEnabled(): boolean {
  const value = process.env.AI_ANALYTICS_CRON_ENABLED;
  if (value === undefined || value === '') return process.env.NODE_ENV === 'production';
  return value !== 'false' && value !== '0';
}

export function isAiAnalyticsReconcileEnabled(): boolean {
  const value = process.env.AI_ANALYTICS_RECONCILE_ENABLED;
  if (value === undefined || value === '') return true;
  return value !== 'false' && value !== '0';
}

export function isAiAnalyticsValidateEnabled(): boolean {
  const value = process.env.AI_ANALYTICS_VALIDATE_ENABLED;
  if (value === undefined || value === '') return true;
  return value !== 'false' && value !== '0';
}

export function isAiUsageLegacyWriteEnabled(): boolean {
  const value = process.env.AI_USAGE_LEGACY_WRITE;
  if (value === undefined || value === '') return true;
  return value !== 'false' && value !== '0';
}
