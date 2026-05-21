/**
 * Resolves connection URLs from explicit values or component env vars.
 * dotenv does NOT expand ${VAR} — this module fixes that at startup.
 */

export interface ResolvedEnvUrls {
  databaseUrl: string;
  redisUrl: string;
  minioUrl: string;
}

function hasUnresolvedInterpolation(value: string): boolean {
  return value.includes('${') || value.includes('%');
}

function encodeCredential(value: string): string {
  return encodeURIComponent(value);
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['DATABASE_URL']?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) {
    return explicit;
  }

  const host = env['DB_HOST'] ?? 'localhost';
  const port = env['DB_PORT'] ?? '5432';
  const name = env['DB_NAME'] ?? 'pranidoctor';
  const user = env['DB_USER'] ?? 'pranidoctor';
  const password = env['DB_PASSWORD'] ?? 'pranidoctor_dev_password';

  return `postgresql://${encodeCredential(user)}:${encodeCredential(password)}@${host}:${port}/${name}`;
}

export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['REDIS_URL']?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) {
    return explicit;
  }

  const host = env['REDIS_HOST'] ?? 'localhost';
  const port = env['REDIS_PORT'] ?? '6379';
  const password = env['REDIS_PASSWORD']?.trim();

  if (password) {
    return `redis://:${encodeCredential(password)}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

export function resolveMinioUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['MINIO_URL']?.trim() ?? env['S3_ENDPOINT']?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) {
    return explicit.replace(/\/$/, '');
  }

  const host = env['MINIO_HOST'] ?? env['S3_HOST'] ?? '127.0.0.1';
  const port = env['MINIO_PORT'] ?? env['S3_PORT'] ?? '9000';
  const useSsl = (env['MINIO_USE_SSL'] ?? 'false').toLowerCase() === 'true';
  const protocol = useSsl ? 'https' : 'http';

  return `${protocol}://${host}:${port}`;
}

export function resolveEnvUrls(env: NodeJS.ProcessEnv = process.env): ResolvedEnvUrls {
  return {
    databaseUrl: resolveDatabaseUrl(env),
    redisUrl: resolveRedisUrl(env),
    minioUrl: resolveMinioUrl(env),
  };
}

/**
 * Writes resolved URLs back to process.env so Prisma CLI and child processes see them.
 */
export function applyResolvedEnv(env: NodeJS.ProcessEnv = process.env): ResolvedEnvUrls {
  const resolved = resolveEnvUrls(env);

  env['DATABASE_URL'] = resolved.databaseUrl;
  env['REDIS_URL'] = resolved.redisUrl;
  env['MINIO_URL'] = resolved.minioUrl;

  if (!env['S3_ENDPOINT'] || hasUnresolvedInterpolation(env['S3_ENDPOINT'])) {
    env['S3_ENDPOINT'] = resolved.minioUrl;
  }

  return resolved;
}
