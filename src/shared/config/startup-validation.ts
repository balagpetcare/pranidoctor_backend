import { getRedis, isRedisInitialized } from '../../infra/redis/redis.client.js';
import { getStorage, isStorageEnabled } from '../../modules/media/storage/storage.factory.js';
import { checkDatabaseConnection } from '../database/prisma.js';

import { omitUndefined } from '../types/object.utils.js';

import type { AppConfig } from './config.schema.js';
import { resolveEnvUrls } from './env.resolver.js';
import {
  isRedisEnabled,
  isRedisRequired,
  isStorageRequired,
  isStrictStartupMode,
} from './infra.flags.js';

export interface ServiceCheckResult {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  optional?: boolean;
  warning?: boolean;
}

export interface StartupValidationResult {
  ok: boolean;
  checks: ServiceCheckResult[];
  resolvedUrls: {
    databaseUrl: string;
    redisUrl: string;
    storageUrl: string;
  };
  warnings: string[];
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return url.replace(/:[^:@]+@/, ':***@');
  }
}

export async function validateStartup(config: AppConfig): Promise<StartupValidationResult> {
  const resolvedUrls = resolveEnvUrls();
  const checks: ServiceCheckResult[] = [];
  const warnings: string[] = [];
  const strict = isStrictStartupMode(config);

  const dbStart = Date.now();
  try {
    const db = await checkDatabaseConnection();
    checks.push(
      omitUndefined({
        name: 'postgresql',
        healthy: db.healthy,
        latencyMs: db.latency,
        error: db.error,
        optional: false,
      })
    );
    if (!db.healthy) {
      warnings.push('PostgreSQL is required — set DATABASE_URL to your external instance');
    }
  } catch (error) {
    checks.push({
      name: 'postgresql',
      healthy: false,
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (isRedisEnabled(config) && isRedisInitialized()) {
    const redisStart = Date.now();
    try {
      const redis = getRedis();
      const pong = await redis.ping();
      const healthy = pong === 'PONG';
      const required = isRedisRequired(config);
      checks.push({
        name: 'redis',
        healthy,
        latencyMs: Date.now() - redisStart,
        optional: !required,
        warning: !healthy && !required,
      });
      if (!healthy && !required) {
        warnings.push('Redis unavailable — OTP, sessions, and queues disabled until Redis is up');
      }
    } catch (error) {
      const required = isRedisRequired(config);
      checks.push({
        name: 'redis',
        healthy: false,
        latencyMs: Date.now() - redisStart,
        error: error instanceof Error ? error.message : String(error),
        optional: !required,
        warning: !required,
      });
      if (!required) {
        warnings.push('Redis unavailable — continuing in development without cache');
      }
    }
  } else {
    checks.push({
      name: 'redis',
      healthy: true,
      optional: true,
      error: 'Redis disabled (REDIS_ENABLED=false)',
    });
    warnings.push('Redis disabled — auth OTP and background jobs require Redis when enabled');
  }

  if (isStorageEnabled(config)) {
    const storageStart = Date.now();
    const storageLabel =
      config.storage.driver === 'local' ? 'local-storage' : config.storage.driver;
    try {
      const storage = getStorage();
      const health = await storage.checkHealth();
      const required = isStorageRequired(config);
      checks.push(
        omitUndefined({
          name: storageLabel,
          healthy: health.healthy,
          latencyMs: health.latency ?? Date.now() - storageStart,
          error: health.error,
          optional: !required,
          warning: !health.healthy && !required,
        })
      );
      if (!health.healthy && !required) {
        warnings.push(
          `Storage (${config.storage.driver}) unavailable — media uploads may fail until configured`
        );
      }
    } catch (error) {
      const required = isStorageRequired(config);
      checks.push({
        name: storageLabel,
        healthy: false,
        latencyMs: Date.now() - storageStart,
        error: error instanceof Error ? error.message : String(error),
        optional: !required,
        warning: !required,
      });
    }
  } else {
    checks.push({
      name: 'storage',
      healthy: true,
      optional: true,
      error: `Storage disabled (STORAGE_DRIVER=${config.storage.driver})`,
    });
    if (strict) {
      warnings.push('Storage is disabled — not allowed in production');
    } else {
      warnings.push('Storage disabled — set STORAGE_DRIVER=local|minio|s3 when needed');
    }
  }

  const requiredChecks = checks.filter((c) => !c.optional);
  const ok = requiredChecks.every((c) => c.healthy);

  return {
    ok,
    checks,
    warnings,
    resolvedUrls: {
      databaseUrl: maskUrl(resolvedUrls.databaseUrl),
      redisUrl: maskUrl(resolvedUrls.redisUrl),
      storageUrl: maskUrl(resolvedUrls.minioUrl),
    },
  };
}

export function formatStartupValidation(result: StartupValidationResult): string {
  const lines = [
    'Startup validation:',
    `  Resolved DATABASE_URL: ${result.resolvedUrls.databaseUrl}`,
    `  Resolved REDIS_URL:    ${result.resolvedUrls.redisUrl}`,
    `  Resolved STORAGE:      ${result.resolvedUrls.storageUrl}`,
    '',
  ];

  for (const check of result.checks) {
    const status = check.healthy ? 'OK' : check.warning ? 'WARN' : 'FAIL';
    const latency = check.latencyMs !== undefined ? ` (${check.latencyMs}ms)` : '';
    const optional = check.optional ? ' [optional]' : ' [required]';
    const err = check.error ? ` — ${check.error}` : '';
    lines.push(`  [${status}] ${check.name}${latency}${optional}${err}`);
  }

  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  lines.push('');
  lines.push(
    result.ok
      ? 'All required services are healthy.'
      : 'One or more required services failed.'
  );

  return lines.join('\n');
}
