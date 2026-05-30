import { logInfo, logWarn } from '../logger/logger.js';

import {
  getSentryEnvironment,
  getSentryRelease,
  getSentryTracesSampleRate,
  isSentryEnabled,
  scrubSentryEvent,
} from './sentry-config.js';

let sentryReady = false;

export function isSentryReady(): boolean {
  return sentryReady;
}

/** Initializes @sentry/node when SENTRY_DSN is set. Safe no-op if package missing. */
export async function initSentry(): Promise<void> {
  if (!isSentryEnabled()) return;

  const dsn = process.env['SENTRY_DSN']!.trim();

  try {
    const Sentry = await import('@sentry/node');
    const release = getSentryRelease();
    Sentry.init({
      dsn,
      environment: getSentryEnvironment(),
      ...(release ? { release } : {}),
      tracesSampleRate: getSentryTracesSampleRate(),
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
    });
    sentryReady = true;
    logInfo('Sentry initialized', {
      environment: getSentryEnvironment(),
      release: getSentryRelease(),
    });
  } catch (error) {
    logWarn('SENTRY_DSN set but @sentry/node could not load', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function captureSentryException(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!sentryReady) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.withScope((scope) => {
      if (context?.requestId) scope.setTag('request_id', String(context.requestId));
      if (context?.route) scope.setTag('route', String(context.route));
      if (context?.queue) scope.setTag('queue', String(context.queue));
      if (context?.jobId) scope.setTag('job_id', String(context.jobId));
      if (context?.jobName) scope.setTag('job_name', String(context.jobName));
      if (context?.source) scope.setTag('source', String(context.source));
      if (context?.userId) scope.setUser({ id: String(context.userId) });
      Sentry.captureException(error);
    });
  } catch {
    // ignore secondary failures
  }
}
