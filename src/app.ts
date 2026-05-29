import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';

import { createHealthRouter } from './api/health/health.routes.js';
import { createMetricsRouter } from './api/metrics/metrics.routes.js';
import type { AppConfig } from './shared/config/config.schema.js';
import { errorHandler, notFoundHandler } from './shared/errors/error.handler.js';
import { getLogger } from './shared/logger/logger.js';
import { contextMiddleware, createLoggerMiddleware } from './shared/middleware/index.js';
import { rateLimitApi } from './shared/security/rate-limit/rate-limit.service.js';
import { rateLimitUnlessProbe } from './shared/security/rate-limit/probe-exempt.js';
import { whenRateLimitAvailable } from './shared/security/rate-limit/safe-rate-limit.js';
import { applySecurityMiddleware } from './shared/security/middleware/security-stack.js';

function createCorsOriginValidator(origins: string[]) {
  const allowed = new Set(origins);
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    if (!origin || allowed.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not allowed'), false);
  };
}

export function createApp(config: AppConfig): Express {
  const app = express();
  const logger = getLogger();

  app.set('trust proxy', 1);

  applySecurityMiddleware(app, config);

  const corsOrigins = config.cors.origins.length > 0
    ? config.cors.origins
    : ['http://localhost:3001'];

  app.use(cors({
    origin: createCorsOriginValidator(corsOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Trace-Id',
      'X-API-Docs-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Trace-Id', 'X-API-Version'],
    maxAge: 600,
  }));

  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(contextMiddleware);
  app.use(createLoggerMiddleware(logger, config));

  const healthRouter = createHealthRouter(config);
  app.use('/', healthRouter);

  if (process.env['METRICS_ENABLED'] !== 'false') {
    app.use('/', createMetricsRouter());
  }

  app.use(rateLimitUnlessProbe(whenRateLimitAvailable(rateLimitApi)));

  app.use((_req, res, next) => {
    res.setHeader('X-API-Version', 'v1');
    next();
  });

  return app;
}

export function finalizeApp(app: Express): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}
