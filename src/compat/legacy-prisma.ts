/**
 * Web-compatible Prisma singleton for migrated seed + legacy services.
 * Bridges Next monolith `src/lib/prisma.ts` to backend `createPrismaClient`.
 */
import { loadEnvironment } from '../shared/config/load-env.js';
import { loadConfig } from '../shared/config/config.loader.js';
import { createLogger } from '../shared/logger/logger.js';
import {
  createPrismaClient,
  disconnectPrisma as backendDisconnect,
  getPrisma,
} from '../shared/database/prisma.js';

import type { PrismaClient } from '../generated/prisma/index.js';

loadEnvironment();

let initialized = false;

function ensureClient(): PrismaClient {
  if (!initialized) {
    const config = loadConfig();
    createLogger(config);
    createPrismaClient({ config });
    initialized = true;
  }
  return getPrisma();
}

/** Drop-in replacement for web `prisma` export used in legacy code. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = ensureClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export async function disconnectPrisma(): Promise<void> {
  await backendDisconnect();
  initialized = false;
}
