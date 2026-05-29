import type { AppConfig } from '../../shared/config/config.schema.js';
import { isRedisEnabled, isStorageRequired } from '../../shared/config/infra.flags.js';
import { checkDatabaseConnection } from '../../shared/database/prisma.js';
import { logWarn } from '../../shared/logger/logger.js';
import {
  recordDatabaseProbe,
  recordReadiness,
  recordRedisProbe,
} from '../../shared/monitoring/metrics/index.js';
import { checkRedisConnection } from '../../infra/redis/redis.client.js';
import { getQueue, QueueNames } from '../../infra/queue/index.js';
import {
  getStorage,
  getStorageRuntimeDegradeReason,
  isStorageEnabled,
  isStorageRuntimeDegraded,
} from '../../modules/media/storage/storage.factory.js';
import { listRegisteredPaths } from '../../modules/compat-web/route-registry.js';
import { moduleRegistry } from '../../shared/module/module-registry.js';

import { checkAiHealth } from './ai-health.service.js';

import type {
  HealthCheckResult,
  HealthResponse,
  LivenessResponse,
  ModulesHealthResponse,
  ReadinessResponse,
  DependencyStatus,
} from './health.types.js';

const startTime = Date.now();

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const result = await checkDatabaseConnection();
    return {
      name: 'database',
      status: result.healthy ? 'healthy' : 'unhealthy',
      latency: result.latency,
      ...(result.error && { message: result.error }),
    };
  } catch (error) {
    const latency = Date.now() - start;
    recordDatabaseProbe({ up: false, latencyMs: latency });
    return {
      name: 'database',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  return checkDatabase();
}

export async function checkRedisHealth(config?: AppConfig): Promise<HealthCheckResult> {
  return checkRedis(config);
}

export async function checkAiHealthStatus(): Promise<HealthCheckResult> {
  return checkAiHealth();
}

export async function checkStorageHealth(config: AppConfig): Promise<HealthCheckResult> {
  const storageDetails = {
    driver: config.storage.driver,
    bucket: config.storage.bucket,
    endpoint: config.storage.endpoint,
    enabled: config.storage.enabled,
    operational: isStorageEnabled(config) && !isStorageRuntimeDegraded(),
  };

  if (!config.storage.enabled) {
    return {
      name: 'storage',
      status: 'degraded',
      latency: 0,
      message: 'Storage disabled (STORAGE_ENABLED=false)',
      details: storageDetails,
    };
  }

  if (!isStorageEnabled(config)) {
    return {
      name: 'storage',
      status: 'degraded',
      latency: 0,
      message: `Storage disabled (driver=${config.storage.driver})`,
      details: storageDetails,
    };
  }

  if (isStorageRuntimeDegraded()) {
    return {
      name: 'storage',
      status: 'degraded',
      latency: 0,
      message:
        getStorageRuntimeDegradeReason() ??
        'Storage unavailable — uploads disabled until MinIO/S3 is reachable',
      details: storageDetails,
    };
  }

  const start = Date.now();
  const required = isStorageRequired(config);

  try {
    const storage = getStorage();
    const health = await storage.checkHealth();
    const status = health.healthy
      ? 'healthy'
      : required
        ? 'unhealthy'
        : 'degraded';

    return {
      name: 'storage',
      status,
      latency: health.latency ?? Date.now() - start,
      ...(health.error && { message: health.error }),
      details: storageDetails,
    };
  } catch (error) {
    return {
      name: 'storage',
      status: required ? 'unhealthy' : 'degraded',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      details: storageDetails,
    };
  }
}

export function getModulesHealth(): ModulesHealthResponse {
  const moduleNames = moduleRegistry.getModuleNames();
  return {
    timestamp: new Date().toISOString(),
    compatWeb: {
      mounted: true,
      legacyRouteFiles: listRegisteredPaths().length,
      apiPrefix: '/api',
    },
    expressModules: moduleNames.map((name) => ({
      name,
      mountPath: `/api/${name}`,
      initialized: moduleRegistry.isInitialized(),
    })),
    totalModuleCount: moduleNames.length,
  };
}

async function checkRedis(config?: AppConfig): Promise<HealthCheckResult> {
  const start = Date.now();

  if (config && !isRedisEnabled(config)) {
    return {
      name: 'redis',
      status: 'degraded',
      latency: 0,
      message: 'Redis disabled (REDIS_ENABLED=false)',
    };
  }

  try {
    const result = await checkRedisConnection();
    const up = result.healthy;
    recordRedisProbe({ up, latencyMs: result.latency });
    const status = result.healthy
      ? 'healthy'
      : result.error?.includes('not initialized')
        ? 'degraded'
        : 'unhealthy';

    return {
      name: 'redis',
      status,
      latency: result.latency,
      ...(result.error && { message: result.error }),
    };
  } catch (error) {
    const latency = Date.now() - start;
    recordRedisProbe({ up: false, latencyMs: latency });
    return {
      name: 'redis',
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkQueues(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const notificationQueue = getQueue(QueueNames.NOTIFICATION);

    if (!notificationQueue) {
      return {
        name: 'queues',
        status: 'degraded',
        latency: Date.now() - start,
        message: 'No queues initialized',
      };
    }

    await notificationQueue.getWaitingCount();

    return {
      name: 'queues',
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'queues',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function checkMemory(): HealthCheckResult {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);

  const heapUsagePercent = (used.heapUsed / used.heapTotal) * 100;

  let status: HealthCheckResult['status'] = 'healthy';
  if (heapUsagePercent > 90) {
    status = 'unhealthy';
  } else if (heapUsagePercent > 75) {
    status = 'degraded';
  }

  return {
    name: 'memory',
    status,
    latency: 0,
    details: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      heapUsagePercent: Math.round(heapUsagePercent),
    },
  };
}

function checkEventLoop(): HealthCheckResult {
  const start = process.hrtime.bigint();
  const lag = Number(process.hrtime.bigint() - start) / 1e6;

  let status: HealthCheckResult['status'] = 'healthy';
  if (lag > 100) {
    status = 'unhealthy';
  } else if (lag > 50) {
    status = 'degraded';
  }

  return {
    name: 'eventLoop',
    status,
    latency: Math.round(lag * 100) / 100,
  };
}

export async function getHealthStatus(config: AppConfig): Promise<HealthResponse> {
  const checks: HealthCheckResult[] = [];

  const [dbResult, redisResult, queueResult, storageResult, aiResult] = await Promise.all([
    checkDatabase(),
    checkRedis(config),
    checkQueues(),
    checkStorageHealth(config),
    checkAiHealth(),
  ]);

  checks.push(dbResult);
  checks.push(redisResult);
  checks.push(queueResult);
  checks.push(storageResult);
  checks.push(aiResult);
  checks.push(checkMemory());
  checks.push(checkEventLoop());

  const unhealthyCount = checks.filter((c) => c.status === 'unhealthy').length;
  const degradedCount = checks.filter((c) => c.status === 'degraded').length;

  let status: HealthResponse['status'];
  if (unhealthyCount > 0) {
    status = 'unhealthy';
  } else if (degradedCount > 0) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  if (status !== 'healthy') {
    logWarn('Health check degraded/unhealthy', {
      status,
      unhealthyCount,
      degradedCount,
      checks: checks.filter((c) => c.status !== 'healthy').map((c) => c.name),
    });
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    version: config.appVersion,
    uptime: uptimeSeconds,
    checks,
  };
}

export async function getReadinessStatus(config: AppConfig): Promise<ReadinessResponse> {
  const checkPromises: Promise<HealthCheckResult>[] = [
    checkDatabase(),
    checkRedis(config),
  ];

  if (isStorageRequired(config)) {
    checkPromises.push(checkStorageHealth(config));
  }

  const checks = await Promise.all(checkPromises);

  const requiredChecks = checks.filter((check) => {
    if (check.name === 'redis' && !isRedisEnabled(config)) return false;
    return true;
  });

  const ready = requiredChecks.every((check) => check.status === 'healthy');
  recordReadiness(ready);

  if (!ready) {
    logWarn('Readiness check failed', {
      checks: checks.filter((c) => c.status !== 'healthy').map((c) => ({
        name: c.name,
        status: c.status,
        message: c.message,
      })),
    });
  }

  return {
    ready,
    timestamp: new Date().toISOString(),
    checks,
  };
}

export function getLivenessStatus(): LivenessResponse {
  return {
    alive: true,
    service: 'api',
    timestamp: new Date().toISOString(),
  };
}

export async function getDependencyStatus(config: AppConfig): Promise<DependencyStatus[]> {
  const [dbResult, redisResult, queueResult, storageResult, aiResult] = await Promise.all([
    checkDatabase(),
    checkRedis(config),
    checkQueues(),
    checkStorageHealth(config),
    checkAiHealth(),
  ]);

  return [
    {
      name: 'PostgreSQL',
      type: 'database',
      status: dbResult.status,
      latency: dbResult.latency,
      required: true,
    },
    {
      name: 'Redis',
      type: 'cache',
      status: redisResult.status,
      latency: redisResult.latency,
      required: isRedisEnabled(config),
      ...(redisResult.message && { message: redisResult.message }),
    },
    {
      name: 'BullMQ',
      type: 'queue',
      status: queueResult.status,
      latency: queueResult.latency,
      required: false,
    },
    {
      name: 'Object Storage',
      type: 'external',
      status: storageResult.status,
      latency: storageResult.latency,
      required: isStorageRequired(config),
      ...(storageResult.message && { message: storageResult.message }),
    },
    {
      name: 'AI Services',
      type: 'ai',
      status: aiResult.status,
      latency: aiResult.latency,
      required: false,
      ...(aiResult.message && { message: aiResult.message }),
    },
  ];
}

export function getSystemInfo(): {
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
} {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
  };
}
