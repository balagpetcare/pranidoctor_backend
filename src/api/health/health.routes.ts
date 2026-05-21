import { Router, type Request, type Response } from 'express';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { isProduction } from '../../shared/config/config.loader.js';

import {
  checkDatabaseHealth,
  checkRedisHealth,
  checkStorageHealth,
  getDependencyStatus,
  getHealthStatus,
  getLivenessStatus,
  getModulesHealth,
  getReadinessStatus,
  getSystemInfo,
} from './health.service.js';

import type { GranularHealthResponse } from './health.types.js';

function granular(
  check: Awaited<ReturnType<typeof checkDatabaseHealth>>,
): GranularHealthResponse {
  return { check, timestamp: new Date().toISOString() };
}

function statusCodeFor(check: { status: string }): number {
  if (check.status === 'unhealthy') return 503;
  return 200;
}

export function createHealthRouter(config: AppConfig): Router {
  const router = Router();

  const healthHandler = async (_req: Request, res: Response): Promise<void> => {
    const health = await getHealthStatus(config);
    const statusCode =
      health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  };

  router.get('/health/db', async (_req: Request, res: Response) => {
    const body = granular(await checkDatabaseHealth());
    res.status(statusCodeFor(body.check)).json(body);
  });

  router.get('/health/redis', async (_req: Request, res: Response) => {
    const body = granular(await checkRedisHealth());
    res.status(statusCodeFor(body.check)).json(body);
  });

  router.get('/health/storage', async (_req: Request, res: Response) => {
    const body = granular(await checkStorageHealth(config));
    res.status(statusCodeFor(body.check)).json(body);
  });

  router.get('/health/modules', (_req: Request, res: Response) => {
    res.status(200).json(getModulesHealth());
  });

  router.get('/health', healthHandler);
  router.post('/health', healthHandler);

  router.get('/ready', async (_req: Request, res: Response) => {
    const readiness = await getReadinessStatus();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  });

  router.get('/live', (_req: Request, res: Response) => {
    const liveness = getLivenessStatus();
    res.status(200).json(liveness);
  });

  router.get('/health/dependencies', async (_req: Request, res: Response) => {
    const dependencies = await getDependencyStatus();
    res.status(200).json({
      success: true,
      data: dependencies,
    });
  });

  if (!isProduction()) {
    router.get('/health/system', (_req: Request, res: Response) => {
      const systemInfo = getSystemInfo();
      res.status(200).json({
        success: true,
        data: systemInfo,
      });
    });
  }

  return router;
}
