import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../../generated/prisma/index.js';

import type { AppConfig } from '../config/config.schema.js';
import { getLogger } from '../logger/logger.js';

let prismaInstance: PrismaClient | null = null;
let poolInstance: Pool | null = null;

export interface PrismaClientOptions {
  config: AppConfig;
}

export function createPrismaClient(options: PrismaClientOptions): PrismaClient {
  const { config } = options;
  const logger = getLogger();
  const isDev = config.nodeEnv === 'development';

  const pool = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
  });

  const adapter = new PrismaPg(pool);

  const prisma = new PrismaClient({
    adapter,
    log: isDev
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

  prisma.$on('error', (e) => {
    logger.error({ msg: 'Prisma error', error: e.message, target: e.target });
  });

  if (isDev) {
    prisma.$on('query', (e) => {
      if (e.duration > 200) {
        logger.warn({
          msg: 'Slow query detected',
          duration: e.duration,
          query: e.query.substring(0, 200),
        });
      }
    });

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
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
