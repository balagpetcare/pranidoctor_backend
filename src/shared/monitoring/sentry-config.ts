import type { ErrorEvent, EventHint } from '@sentry/node';

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

/** True when SENTRY_DSN is set and SENTRY_ENABLED is not explicitly false. */
export function isSentryEnabled(): boolean {
  const dsn = process.env['SENTRY_DSN']?.trim();
  if (!dsn) return false;

  const raw = process.env['SENTRY_ENABLED']?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return true;
}

/** Prefer APP_ENV for staging/prod separation; fall back to NODE_ENV. */
export function getSentryEnvironment(): string {
  const appEnv = process.env['APP_ENV']?.trim();
  if (appEnv) return appEnv;
  return process.env['NODE_ENV'] ?? 'development';
}

/** Release tag for Sentry issue grouping (e.g. pranidoctor-api@1.2.3). */
export function getSentryRelease(serviceName?: string): string | undefined {
  const version = process.env['APP_VERSION']?.trim();
  if (!version) return undefined;
  const name =
    serviceName?.trim() ||
    process.env['APP_NAME']?.trim() ||
    'pranidoctor-api';
  return `${name}@${version}`;
}

export function getSentryTracesSampleRate(): number {
  const raw = process.env['SENTRY_TRACES_SAMPLE_RATE']?.trim();
  const parsed = raw ? Number(raw) : 0.1;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

/** Strip auth headers and cookies before events leave the process. */
export function scrubSentryEvent<T extends ErrorEvent>(
  event: T,
  _hint?: EventHint,
): T | null {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        delete event.request.headers[key];
      }
    }
  }

  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  return event;
}
