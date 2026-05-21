import pino from 'pino';

import type { AppConfig } from '../config/config.schema.js';
import { getRequestContext } from '../context/request-context.js';

import { sanitizeObject, sanitizeError } from './sanitizer.js';

export interface LogContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

let loggerInstance: pino.Logger | null = null;

export function createLogger(config: AppConfig): pino.Logger {
  const isDev = config.nodeEnv === 'development';
  const usePretty = config.log.format === 'pretty' || isDev;

  const logger = pino({
    level: config.log.level,
    base: {
      service: config.appName,
      version: config.appVersion,
      env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        service: bindings['service'],
        version: bindings['version'],
        env: bindings['env'],
        pid: bindings['pid'],
        hostname: bindings['hostname'],
      }),
    },
    mixin: () => {
      const ctx = getRequestContext();
      if (ctx) {
        return {
          requestId: ctx.requestId,
          traceId: ctx.traceId,
          spanId: ctx.spanId,
          ...(ctx.userId && { userId: ctx.userId }),
          ...(ctx.tenantId && { tenantId: ctx.tenantId }),
        };
      }
      return {};
    },
    redact: {
      paths: [
        'password',
        'passwordHash',
        'secret',
        'token',
        'authorization',
        'cookie',
        'otp',
        'code',
        '*.password',
        '*.passwordHash',
        '*.secret',
        '*.token',
        '*.authorization',
        '*.cookie',
        '*.otp',
        '*.code',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    ...(usePretty && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{requestId} | {msg}',
        },
      },
    }),
  });

  loggerInstance = logger;
  return logger;
}

export function getLogger(): pino.Logger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call createLogger first.');
  }
  return loggerInstance;
}

export function createChildLogger(context: LogContext): pino.Logger {
  const logger = getLogger();
  const sanitizedContext = sanitizeObject(context) as Record<string, unknown>;
  return logger.child(sanitizedContext);
}

export function log(level: pino.Level, message: string, data?: Record<string, unknown>): void {
  const logger = getLogger();
  const sanitized = data ? (sanitizeObject(data) as Record<string, unknown>) : {};
  logger[level]({ msg: message, ...sanitized });
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  log('info', message, data);
}

export function logWarn(message: string, data?: Record<string, unknown>): void {
  log('warn', message, data);
}

export function logDebug(message: string, data?: Record<string, unknown>): void {
  log('debug', message, data);
}

export function logError(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
  const logger = getLogger();
  const sanitized = data ? (sanitizeObject(data) as Record<string, unknown>) : {};

  if (error instanceof Error) {
    logger.error({
      msg: message,
      error: sanitizeError(error),
      ...sanitized,
    });
  } else if (error) {
    logger.error({
      msg: message,
      error: String(error),
      ...sanitized,
    });
  } else {
    logger.error({ msg: message, ...sanitized });
  }
}

export function logFatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
  const logger = getLogger();
  const sanitized = data ? (sanitizeObject(data) as Record<string, unknown>) : {};

  if (error instanceof Error) {
    logger.fatal({
      msg: message,
      error: sanitizeError(error),
      ...sanitized,
    });
  } else {
    logger.fatal({ msg: message, ...sanitized });
  }
}
