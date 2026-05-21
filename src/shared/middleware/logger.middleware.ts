import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { HttpLogger, Options } from 'pino-http';

import type { AppConfig } from '../config/config.schema.js';

export function createLoggerMiddleware(
  logger: Logger,
  config: AppConfig
): HttpLogger {
  const isDev = config.nodeEnv === 'development';

  const options: Options = {
    logger,
    autoLogging: {
      ignore: (req: IncomingMessage) => {
        const path = req.url ?? '';
        return path === '/health' || path === '/live' || path === '/ready';
      },
    },
    customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req: IncomingMessage, _res: ServerResponse, error: Error) => {
      return `${req.method} ${req.url} - ${error.message}`;
    },
    customProps: (req: IncomingMessage) => ({
      requestId: req.headers['x-request-id'],
    }),
    serializers: {
      req: (req: IncomingMessage) => ({
        method: req.method,
        url: req.url,
        path: req.url?.split('?')[0],
        ...(isDev && { query: (req as IncomingMessage & { query?: unknown }).query }),
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
  };

  return pinoHttp(options);
}
