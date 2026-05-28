import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { createHealthRouter } from './api/health/health.routes.js';
import type { AppConfig } from './shared/config/config.schema.js';
import { errorHandler, notFoundHandler } from './shared/errors/error.handler.js';
import { getLogger } from './shared/logger/logger.js';
import { contextMiddleware, createLoggerMiddleware } from './shared/middleware/index.js';
import { rateLimitApi } from './shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from './shared/security/rate-limit/safe-rate-limit.js';

export function createApp(config: AppConfig): Express {
  const app = express();
  const logger = getLogger();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
  }));

  app.use(cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Trace-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Trace-Id', 'X-API-Version'],
  }));

  app.use(compression());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(contextMiddleware);
  app.use(createLoggerMiddleware(logger, config));
  app.use(whenRateLimitAvailable(rateLimitApi));

  app.use((_req, res, next) => {
    res.setHeader('X-API-Version', 'v1');
    next();
  });

  const healthRouter = createHealthRouter(config);
  app.use('/', healthRouter);

  return app;
}

export function finalizeApp(app: Express): void {
  app.use(notFoundHandler);
  app.use(errorHandler);
}
