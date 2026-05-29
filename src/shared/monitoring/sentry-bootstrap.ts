import { captureSentryException, initSentry } from './sentry-init.js';
import { notifyErrorWebhook, registerErrorCapture } from './error-tracking.js';

/** Shared Sentry + webhook hook registration for API and worker processes. */
export async function bootstrapSentryMonitoring(): Promise<void> {
  await initSentry();
  registerErrorCapture((error, ctx) => {
    void captureSentryException(error, ctx as Record<string, unknown> | undefined);
    void notifyErrorWebhook(error, ctx);
  });
}
