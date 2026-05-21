/**
 * Minimal runtime bootstrap for seed and CLI scripts (no HTTP server).
 * Initializes env → config → structured pino logger → Prisma (same order as server.ts).
 */
import type { PrismaClient } from '../src/generated/prisma/index.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import type { AppConfig } from '../src/shared/config/config.schema.js';
import { loadEnvironment } from '../src/shared/config/load-env.js';
import {
  createPrismaClient,
  disconnectPrisma as disconnectSharedPrisma,
  getPrisma,
} from '../src/shared/database/prisma.js';
import { createLogger, getLogger } from '../src/shared/logger/logger.js';

import type { Logger } from 'pino';

export interface ScriptRuntime {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
}

let activeRuntime: ScriptRuntime | null = null;

/**
 * Load `.env`, resolve URLs, create the production logger, and open the shared Prisma client.
 * Safe to call once per process; repeated calls return the existing runtime.
 */
export function bootstrapScriptRuntime(options?: { loadEnv?: boolean }): ScriptRuntime {
  if (activeRuntime) {
    return activeRuntime;
  }

  if (options?.loadEnv !== false) {
    loadEnvironment();
  }

  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });

  activeRuntime = {
    config,
    logger: getLogger(),
    prisma: getPrisma(),
  };

  return activeRuntime;
}

/** Tear down Prisma pool; logger remains available until process exit. */
export async function shutdownScriptRuntime(): Promise<void> {
  await disconnectSharedPrisma();
  activeRuntime = null;
}
