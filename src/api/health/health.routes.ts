import { Router, type Request, type Response } from 'express';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { isProduction } from '../../shared/config/config.loader.js';
import {
  alertDependencyUnhealthy,
  alertQueueUnhealthy,
  alertReadinessFailure,
  alertRedisUnavailable,
  alertStorageUnhealthy,
} from '../../shared/monitoring/alerting/health-alerts.js';

import {
  getMobileHealthStatus,
  isMobileHealthOk,
} from './mobile-health.service.js';
import {
  checkAiHealthStatus,
  checkCacheHealth,
  checkDatabaseHealth,
  checkQueueHealth,
  checkRedisHealth,
  checkStorageHealth,
  getDependencyStatus,
  getHealthStatus,
  getLivenessStatus,
  getModulesHealth,
  getReadinessStatus,
  getSystemInfo,
} from './health.service.js';
import {
  toLiteDependencyResponse,
  toLiteGranularResponse,
  toLiteHealthResponse,
  toLiteLivenessResponse,
  toLiteReadinessResponse,
  wantsLiteResponse,
} from './health-response.util.js';

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

  const healthHandler = async (req: Request, res: Response): Promise<void> => {
    const health = await getHealthStatus(config);
    const statusCode =
      health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    const body = wantsLiteResponse(req.query) ? toLiteHealthResponse(health) : health;
    res.status(statusCode).json(body);
  };

  router.get('/health/db', async (req: Request, res: Response) => {
    const body = granular(await checkDatabaseHealth());
    if (body.check.status === 'unhealthy') {
      alertDependencyUnhealthy('database', body.check.message);
    }
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/redis', async (req: Request, res: Response) => {
    const body = granular(await checkRedisHealth(config));
    if (body.check.status === 'unhealthy') {
      alertRedisUnavailable(body.check.message);
    }
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/storage', async (req: Request, res: Response) => {
    const body = granular(await checkStorageHealth(config));
    if (body.check.status === 'unhealthy') {
      alertStorageUnhealthy(body.check.message);
    }
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/cache', async (req: Request, res: Response) => {
    const body = granular(await checkCacheHealth(config));
    if (body.check.status === 'unhealthy') {
      alertRedisUnavailable(body.check.message);
    }
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/queue', async (req: Request, res: Response) => {
    const body = granular(await checkQueueHealth());
    if (body.check.status === 'unhealthy') {
      alertQueueUnhealthy(body.check.message);
    }
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/ai', async (req: Request, res: Response) => {
    const body = granular(await checkAiHealthStatus());
    res
      .status(statusCodeFor(body.check))
      .json(wantsLiteResponse(req.query) ? toLiteGranularResponse(body) : body);
  });

  router.get('/health/modules', (_req: Request, res: Response) => {
    res.status(200).json(getModulesHealth());
  });

  router.get('/health/mobile', async (_req: Request, res: Response) => {
    const status = await getMobileHealthStatus();
    const code = isMobileHealthOk(status) ? 200 : 500;
    res.status(code).json(status);
  });

  router.get('/health', healthHandler);
  router.post('/health', healthHandler);

  router.get('/ready', async (req: Request, res: Response) => {
    const readiness = await getReadinessStatus(config);
    const statusCode = readiness.ready ? 200 : 503;
    if (!readiness.ready) {
      alertReadinessFailure('API not ready — check database, Redis, and required storage');
    }
    const body = wantsLiteResponse(req.query) ? toLiteReadinessResponse(readiness) : readiness;
    res.status(statusCode).json(body);
  });

  router.get('/live', (req: Request, res: Response) => {
    const liveness = getLivenessStatus();
    const body = wantsLiteResponse(req.query) ? toLiteLivenessResponse(liveness) : liveness;
    res.status(200).json(body);
  });

  router.get('/health/dependencies', async (req: Request, res: Response) => {
    const dependencies = await getDependencyStatus(config);
    const data = wantsLiteResponse(req.query)
      ? toLiteDependencyResponse(dependencies)
      : dependencies;
    res.status(200).json({
      success: true,
      data,
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
