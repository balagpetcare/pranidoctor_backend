import { config as loadDotenv } from 'dotenv';

import { applyResolvedEnv } from './env.resolver.js';

let loaded = false;

/**
 * Load .env and resolve DATABASE_URL, REDIS_URL, MINIO_URL.
 * Safe to call multiple times (idempotent).
 */
export function loadEnvironment(): void {
  if (loaded) return;

  loadDotenv();
  applyResolvedEnv();
  loaded = true;
}
