import { z } from 'zod';

import { resolveDatabaseUrl } from './env.resolver.js';

const storageDriverSchema = z.enum(['s3', 'minio', 'local', 'disabled']);

const infrastructureEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (external PostgreSQL)'),
  REDIS_URL: z.string().optional(),
  REDIS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  STORAGE_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  STORAGE_DRIVER: storageDriverSchema.default('disabled'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  LOCAL_STORAGE_PATH: z.string().optional(),
  SKIP_STARTUP_VALIDATION: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export type InfrastructureEnv = z.infer<typeof infrastructureEnvSchema>;

export interface EnvValidationResult {
  ok: boolean;
  env: InfrastructureEnv;
  errors: string[];
  warnings: string[];
}

function collectStorageWarnings(env: InfrastructureEnv): string[] {
  const warnings: string[] = [];
  const driver = env.STORAGE_DRIVER;

  if (driver === 'disabled') {
    warnings.push('STORAGE_DRIVER=disabled — media uploads will not persist to object storage');
    return warnings;
  }

  if (driver === 'local') {
    if (!env.LOCAL_STORAGE_PATH) {
      warnings.push('LOCAL_STORAGE_PATH not set — using default ./.local-storage');
    }
    return warnings;
  }

  const accessKey = env.S3_ACCESS_KEY ?? env.S3_ACCESS_KEY_ID;
  const secretKey = env.S3_SECRET_KEY ?? env.S3_SECRET_ACCESS_KEY;

  if (!env.S3_ENDPOINT) {
    warnings.push(`${driver}: S3_ENDPOINT not set — required for remote object storage`);
  }
  if (!env.S3_BUCKET) {
    warnings.push(`${driver}: S3_BUCKET not set`);
  }
  if (!accessKey || !secretKey) {
    warnings.push(`${driver}: S3 credentials missing — set S3_ACCESS_KEY and S3_SECRET_KEY`);
  }

  return warnings;
}

export function validateInfrastructureEnv(
  rawEnv: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const databaseUrl = resolveDatabaseUrl(rawEnv);

  const parsed = infrastructureEnvSchema.safeParse({
    NODE_ENV: rawEnv['NODE_ENV'],
    DATABASE_URL: databaseUrl,
    REDIS_URL: rawEnv['REDIS_URL'],
    REDIS_ENABLED: rawEnv['REDIS_ENABLED'],
    STORAGE_ENABLED: rawEnv['STORAGE_ENABLED'],
    STORAGE_DRIVER: (rawEnv['STORAGE_DRIVER'] ?? 'disabled').toLowerCase(),
    S3_ENDPOINT: rawEnv['S3_ENDPOINT'] || rawEnv['MINIO_URL'] || undefined,
    S3_BUCKET: rawEnv['S3_BUCKET'],
    S3_ACCESS_KEY: rawEnv['S3_ACCESS_KEY'] ?? rawEnv['S3_ACCESS_KEY_ID'],
    S3_ACCESS_KEY_ID: rawEnv['S3_ACCESS_KEY_ID'],
    S3_SECRET_KEY: rawEnv['S3_SECRET_KEY'] ?? rawEnv['S3_SECRET_ACCESS_KEY'],
    S3_SECRET_ACCESS_KEY: rawEnv['S3_SECRET_ACCESS_KEY'],
    LOCAL_STORAGE_PATH: rawEnv['LOCAL_STORAGE_PATH'],
    SKIP_STARTUP_VALIDATION: rawEnv['SKIP_STARTUP_VALIDATION'],
  });

  if (!parsed.success) {
    for (const issue of parsed.error.errors) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return {
      ok: false,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: databaseUrl,
        REDIS_ENABLED: true,
        STORAGE_DRIVER: 'disabled',
        SKIP_STARTUP_VALIDATION: false,
      },
      errors,
      warnings,
    };
  }

  const env = parsed.data;

  if (!env.DATABASE_URL || env.DATABASE_URL.includes('${')) {
    errors.push(
      'DATABASE_URL: set a full PostgreSQL URL (external instance). Component vars DB_* are resolved separately.'
    );
  }

  if (env.NODE_ENV === 'production') {
    if (!env.REDIS_ENABLED) {
      errors.push('REDIS_ENABLED: Redis is required in production (set REDIS_URL)');
    }
    if (env.STORAGE_DRIVER === 'disabled') {
      errors.push('STORAGE_DRIVER: cannot be disabled in production');
    }
    if (env.STORAGE_DRIVER !== 'local' && env.STORAGE_DRIVER !== 'disabled') {
      const accessKey = env.S3_ACCESS_KEY ?? env.S3_ACCESS_KEY_ID;
      const secretKey = env.S3_SECRET_KEY ?? env.S3_SECRET_ACCESS_KEY;
      if (!env.S3_ENDPOINT || !env.S3_BUCKET || !accessKey || !secretKey) {
        errors.push(
          'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY are required in production for object storage'
        );
      }
    }
  }

  warnings.push(...collectStorageWarnings(env));

  if (env.NODE_ENV === 'development' && !env.REDIS_ENABLED) {
    warnings.push('REDIS_ENABLED=false — OTP, sessions, and queues will not work until Redis is available');
  }

  if (env.NODE_ENV === 'development' && !env.STORAGE_ENABLED) {
    warnings.push('STORAGE_ENABLED=false — file uploads are disabled until storage is enabled');
  }

  if (env.SKIP_STARTUP_VALIDATION && env.NODE_ENV === 'production') {
    warnings.push('SKIP_STARTUP_VALIDATION is set — not recommended for production');
  }

  return {
    ok: errors.length === 0,
    env,
    errors,
    warnings,
  };
}

export function formatEnvValidation(result: EnvValidationResult): string {
  const lines: string[] = ['Environment validation:'];

  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const e of result.errors) {
      lines.push(`  ✗ ${e}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const w of result.warnings) {
      lines.push(`  ⚠ ${w}`);
    }
  }

  lines.push('', result.ok ? 'Environment OK.' : 'Environment validation failed.');
  return lines.join('\n');
}
