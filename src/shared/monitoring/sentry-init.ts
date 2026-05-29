import { logInfo, logWarn } from '../logger/logger.js';

let sentryReady = false;

export function isSentryReady(): boolean {
  return sentryReady;
}

/** Initializes @sentry/node when SENTRY_DSN is set. Safe no-op if package missing. */
export async function initSentry(): Promise<void> {
  const dsn = process.env['SENTRY_DSN']?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      release: process.env['APP_VERSION']?.trim(),
      tracesSampleRate: Number(process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1'),
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
    sentryReady = true;
    logInfo('Sentry initialized');
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
      if (context?.userId) scope.setUser({ id: String(context.userId) });
      Sentry.captureException(error);
    });
  } catch {
    // ignore secondary failures
  }
}
