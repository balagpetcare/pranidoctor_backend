/**
 * Standalone startup validation (without starting HTTP server).
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import {
  formatStartupValidation,
  validateStartup,
} from '../src/shared/config/startup-validation.js';
import { isRedisEnabled } from '../src/shared/config/infra.flags.js';
import { createPrismaClient, disconnectPrisma } from '../src/shared/database/prisma.js';
import { createRedisClient, disconnectRedis } from '../src/infra/redis/redis.client.js';
import {
  initializeStorage,
  isStorageEnabled,
} from '../src/modules/media/storage/storage.factory.js';
import { createLogger } from '../src/shared/logger/logger.js';

loadEnvironment();

async function main(): Promise<void> {
  const config = loadConfig();
  createLogger(config);

  createPrismaClient({ config });

  if (isRedisEnabled(config)) {
    createRedisClient({ config });
  }

  if (isStorageEnabled(config)) {
    initializeStorage(config);
  }

  const result = await validateStartup(config);
  console.log(formatStartupValidation(result));

  await disconnectRedis();
  await disconnectPrisma();

  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
