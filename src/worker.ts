import { config as loadEnv } from 'dotenv';

loadEnv();

import { createRedisClient, disconnectRedis } from './infra/redis/redis.client.js';
import { initializeQueueConnection, closeAllQueues } from './infra/queue/queue.service.js';
import { loadConfig, type AppConfig } from './shared/config/index.js';
import { createPrismaClient, disconnectPrisma } from './shared/database/prisma.js';
import { createLogger, getLogger } from './shared/logger/logger.js';
import { captureException } from './shared/monitoring/error-tracking.js';
import { bootstrapSentryMonitoring } from './shared/monitoring/sentry-bootstrap.js';

let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  let config: AppConfig;

  try {
    config = loadConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  const logger = createLogger(config);
  await bootstrapSentryMonitoring();
  logger.info({ msg: 'Starting worker', env: config.nodeEnv });

  try {
    createPrismaClient({ config });
    logger.info({ msg: 'Database client initialized' });
  } catch (error) {
    logger.error({ msg: 'Failed to initialize database', error });
    process.exit(1);
  }

  try {
    createRedisClient({ config });
    logger.info({ msg: 'Redis client initialized' });
  } catch (error) {
    logger.error({ msg: 'Failed to initialize Redis', error });
    process.exit(1);
  }

  try {
    initializeQueueConnection(config);
    logger.info({ msg: 'Queue connection initialized' });
  } catch (error) {
    logger.error({ msg: 'Failed to initialize queue connection', error });
    process.exit(1);
  }

  logger.info({ msg: 'Worker ready - No job processors registered yet (Phase 1 foundation)' });

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logger.warn({ msg: 'Shutdown already in progress' });
      return;
    }

    isShuttingDown = true;
    logger.info({ msg: 'Shutting down worker', signal });

    const shutdownTimeout = setTimeout(() => {
      logger.error({ msg: 'Shutdown timeout exceeded, forcing exit' });
      process.exit(1);
    }, 30000);

    try {
      await closeAllQueues();
      logger.info({ msg: 'Queues closed' });
    } catch (error) {
      logger.error({ msg: 'Error closing queues', error });
    }

    try {
      await disconnectRedis();
      logger.info({ msg: 'Redis disconnected' });
    } catch (error) {
      logger.error({ msg: 'Error disconnecting Redis', error });
    }

    try {
      await disconnectPrisma();
      logger.info({ msg: 'Database disconnected' });
    } catch (error) {
      logger.error({ msg: 'Error disconnecting database', error });
    }

    clearTimeout(shutdownTimeout);
    logger.info({ msg: 'Worker shutdown complete' });
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    const logger = getLogger();
    logger.fatal({ msg: 'Uncaught exception', error: error.message, stack: error.stack });
    captureException(error, { source: 'uncaughtException' });
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    const logger = getLogger();
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.fatal({ msg: 'Unhandled rejection', reason });
    captureException(error, { source: 'unhandledRejection' });
    void shutdown('unhandledRejection');
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
