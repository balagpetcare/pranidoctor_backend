import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../../generated/prisma/index.js';

import type { AppConfig } from '../config/config.schema.js';
import { getLogger } from '../logger/logger.js';
import { recordDbQuery } from '../monitoring/metrics/db.metrics.js';
import { getSlowQueryThresholdMs } from '../monitoring/metrics/monitoring-config.js';
import { parsePrismaQueryLabels } from '../monitoring/metrics/prisma-query-labels.js';
import { recordDatabaseProbe } from '../monitoring/metrics/dependency.metrics.js';

let prismaInstance: PrismaClient | null = null;
let poolInstance: Pool | null = null;

export interface PrismaClientOptions {
  config: AppConfig;
}

export function createPrismaClient(options: PrismaClientOptions): PrismaClient {
  const { config } = options;
  const logger = getLogger();
  const isDev = config.nodeEnv === 'development';
  const queryMetricsEnabled =
    process.env['METRICS_ENABLED'] !== 'false' &&
    process.env['DB_QUERY_METRICS_ENABLED'] !== 'false';

  const pool = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
  });

  const adapter = new PrismaPg(pool);

  const logLevels: Array<{ emit: 'event'; level: 'query' | 'error' | 'warn' }> = [
    { emit: 'event', level: 'error' },
  ];
  if (isDev || queryMetricsEnabled) {
    logLevels.unshift({ emit: 'event', level: 'query' });
  }
  if (isDev) {
    logLevels.push({ emit: 'event', level: 'warn' });
  }

  const prisma = new PrismaClient({
    adapter,
    log: logLevels,
  });

  prisma.$on('error', (e) => {
    logger.error({ msg: 'Prisma error', error: e.message, target: e.target });
  });

  prisma.$on('query', (e) => {
    const { model, operation } = parsePrismaQueryLabels(e.query);
    if (queryMetricsEnabled) {
      recordDbQuery({ model, operation, durationMs: e.duration, logger });
      return;
    }
    if (isDev && e.duration > getSlowQueryThresholdMs()) {
      logger.warn({
        event: 'db.query.slow',
        msg: 'Slow query detected',
        durationMs: e.duration,
        model,
        operation,
        query: e.query.substring(0, 200),
      });
    }
  });

  if (isDev) {
    prisma.$on('warn', (e) => {
      logger.warn({ msg: 'Prisma warning', warning: e.message });
    });
  }

  poolInstance = pool;
  prismaInstance = prisma;
  return prisma;
}

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    throw new Error('Prisma client not initialized. Call createPrismaClient first.');
  }
  return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    const logger = getLogger();
    logger.info({ msg: 'Disconnecting Prisma client' });
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }

  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function checkDatabaseConnection(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const prisma = getPrisma();
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    recordDatabaseProbe({ up: true, latencyMs: latency });
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    recordDatabaseProbe({ up: false, latencyMs: latency });
    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
