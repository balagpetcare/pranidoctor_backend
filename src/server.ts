import { loadEnvironment } from './shared/config/load-env.js';

loadEnvironment();

import { createApp, finalizeApp } from './app.js';
import { createDocsRouter } from './api/docs/docs.routes.js';
import { createCompatWebRouter } from './modules/compat-web/index.js';
import { initializeStorage, isStorageEnabled } from './modules/media/storage/index.js';
import { createAllModules } from './modules/index.js';
import { loadModules, unloadModules } from './shared/module/module-loader.js';
import { initializeCacheService } from './infra/cache/cache.service.js';
import { createRedisClient, disconnectRedis } from './infra/redis/redis.client.js';
import { initializeQueueConnection, closeAllQueues } from './infra/queue/queue.service.js';
import { loadConfig, type AppConfig } from './shared/config/index.js';
import {
  formatStartupValidation,
  validateStartup,
} from './shared/config/startup-validation.js';
import {
  isRedisEnabled,
  shouldSkipStartupValidation,
} from './shared/config/infra.flags.js';
import { createPrismaClient, disconnectPrisma } from './shared/database/prisma.js';
import { createLogger, logInfo, logError, logFatal, logWarn } from './shared/logger/logger.js';

let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  let config: AppConfig;

  try {
    config = loadConfig();
  } catch (error) {
    console.error('Failed to load configuration:', error);
    process.exit(1);
  }

  createLogger(config);
  logInfo('Starting server', { env: config.nodeEnv, port: config.port });

  try {
    createPrismaClient({ config });
    logInfo('Database client initialized');
  } catch (error) {
    logFatal('Failed to initialize database', error);
    process.exit(1);
  }

  if (isRedisEnabled(config)) {
    try {
      createRedisClient({ config });
      logInfo('Redis client initialized');
    } catch (error) {
      if (config.nodeEnv === 'production') {
        logFatal('Failed to initialize Redis', error);
        process.exit(1);
      }
      logWarn('Redis client initialization failed — continuing without Redis', {
        error: String(error),
      });
    }

    try {
      initializeCacheService(config);
      logInfo('Cache service initialized');
    } catch (error) {
      logWarn('Cache service skipped', { error: String(error) });
    }

    try {
      initializeQueueConnection(config);
      logInfo('Queue connection initialized');
    } catch (error) {
      logWarn('Queue connection skipped', { error: String(error) });
    }
  } else {
    logWarn('Redis disabled (REDIS_ENABLED=false) — cache, OTP, and queues unavailable');
  }

  if (isStorageEnabled(config)) {
    try {
      initializeStorage(config);
      logInfo('Storage initialized', {
        driver: config.storage.driver,
        bucket: config.storage.bucket,
      });
    } catch (error) {
      if (config.nodeEnv === 'production') {
        logFatal('Failed to initialize storage', error);
        process.exit(1);
      }
      logWarn('Storage initialization skipped', { error: String(error) });
    }
  } else {
    logWarn('Storage disabled or not configured', { driver: config.storage.driver });
  }

  if (!shouldSkipStartupValidation(config)) {
    const validation = await validateStartup(config);
    console.log(formatStartupValidation(validation));
    if (!validation.ok) {
      logFatal('Startup validation failed — required services unavailable');
      process.exit(1);
    }
    for (const warning of validation.warnings) {
      logWarn(warning);
    }
    logInfo('Startup validation passed', { checks: validation.checks.length });
  } else {
    logWarn('Startup validation skipped (SKIP_STARTUP_VALIDATION=true)');
  }

  const app = createApp(config);

  app.use('/api/docs', createDocsRouter());

  try {
    const compatRouter = await createCompatWebRouter();
    app.use('/api', compatRouter);
    logInfo('Compat web API mounted', {
      routes: 'legacy /api/*',
      stackLayers: compatRouter.stack.length,
    });
  } catch (error) {
    logFatal('Failed to mount compat web API', error);
    process.exit(1);
  }

  try {
    await loadModules(app, createAllModules(), { apiPrefix: '/api' });
    logInfo('API modules mounted');
  } catch (error) {
    logFatal('Failed to load modules', error);
    process.exit(1);
  }

  finalizeApp(app);

  const server = app.listen(config.port, () => {
    logInfo('Server started', {
      port: config.port,
      env: config.nodeEnv,
      version: config.appVersion,
      node: process.version,
    });
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      logInfo('Shutdown already in progress');
      return;
    }

    isShuttingDown = true;
    logInfo('Shutting down', { signal });

    const shutdownTimeout = setTimeout(() => {
      logError('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 30000);

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logInfo('HTTP server closed');
    } catch (error) {
      logError('Error closing HTTP server', error);
    }

    try {
      await closeAllQueues();
      logInfo('Queues closed');
    } catch (error) {
      logError('Error closing queues', error);
    }

    try {
      await disconnectRedis();
      logInfo('Redis disconnected');
    } catch (error) {
      logError('Error disconnecting Redis', error);
    }

    try {
      await unloadModules();
      logInfo('Modules unloaded');
    } catch (error) {
      logError('Error unloading modules', error);
    }

    try {
      await disconnectPrisma();
      logInfo('Database disconnected');
    } catch (error) {
      logError('Error disconnecting database', error);
    }

    clearTimeout(shutdownTimeout);
    logInfo('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logFatal('Uncaught exception', error);
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logFatal('Unhandled rejection', reason instanceof Error ? reason : undefined, {
      reason: reason instanceof Error ? undefined : String(reason),
    });
    void shutdown('unhandledRejection');
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
