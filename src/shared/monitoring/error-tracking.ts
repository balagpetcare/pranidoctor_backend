import { logError, logInfo } from '../logger/logger.js';

export interface ErrorTrackingContext {
  requestId?: string;
  userId?: string;
  route?: string;
  source?: string;
  queue?: string;
  jobId?: string;
  jobName?: string;
}

let captureHook: ((error: unknown, context?: ErrorTrackingContext) => void) | null =
  null;

/** Register external error tracker (Sentry webhook adapter, etc.). */
export function registerErrorCapture(
  hook: (error: unknown, context?: ErrorTrackingContext) => void,
): void {
  captureHook = hook;
  logInfo('Error tracking hook registered');
}

export function captureException(
  error: unknown,
  context?: ErrorTrackingContext,
): void {
  logError('Captured exception', error, context as Record<string, unknown> | undefined);
  captureHook?.(error, context);
}

/** Optional webhook reporter when ERROR_TRACKING_WEBHOOK_URL is set. */
export async function notifyErrorWebhook(
  error: unknown,
  context?: ErrorTrackingContext,
): Promise<void> {
  const url = process.env['ERROR_TRACKING_WEBHOOK_URL']?.trim();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context,
        service: 'pranidoctor-backend',
        env: process.env['NODE_ENV'],
      }),
    });
  } catch (webhookError) {
    logError('Error tracking webhook failed', webhookError);
  }
}
