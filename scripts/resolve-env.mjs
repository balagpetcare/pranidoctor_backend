/**
 * Plain JS env resolver for Prisma CLI (prisma.config.ts) and shell scripts.
 * Keep in sync with src/shared/config/env.resolver.ts
 */
import { config as loadDotenv } from 'dotenv';

function hasUnresolvedInterpolation(value) {
  return value.includes('${') || value.includes('%');
}

function encodeCredential(value) {
  return encodeURIComponent(value);
}

export function resolveDatabaseUrl(env = process.env) {
  const explicit = env.DATABASE_URL?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) return explicit;

  const host = env.DB_HOST ?? 'localhost';
  const port = env.DB_PORT ?? '5432';
  const name = env.DB_NAME ?? 'pranidoctor';
  const user = env.DB_USER ?? 'pranidoctor';
  const password = env.DB_PASSWORD ?? 'pranidoctor_dev_password';

  return `postgresql://${encodeCredential(user)}:${encodeCredential(password)}@${host}:${port}/${name}`;
}

export function resolveRedisUrl(env = process.env) {
  const explicit = env.REDIS_URL?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) return explicit;

  const host = env.REDIS_HOST ?? 'localhost';
  const port = env.REDIS_PORT ?? '6379';
  const password = env.REDIS_PASSWORD?.trim();

  if (password) {
    return `redis://:${encodeCredential(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

export function resolveMinioUrl(env = process.env) {
  const explicit = env.MINIO_URL?.trim() ?? env.S3_ENDPOINT?.trim();
  if (explicit && !hasUnresolvedInterpolation(explicit)) {
    return explicit.replace(/\/$/, '');
  }

  const host = env.MINIO_HOST ?? env.S3_HOST ?? '127.0.0.1';
  const port = env.MINIO_PORT ?? env.S3_PORT ?? '9000';
  const useSsl = (env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true';
  const protocol = useSsl ? 'https' : 'http';

  return `${protocol}://${host}:${port}`;
}

export function applyResolvedEnv(env = process.env) {
  loadDotenv();

  env.DATABASE_URL = resolveDatabaseUrl(env);
  env.REDIS_URL = resolveRedisUrl(env);
  env.MINIO_URL = resolveMinioUrl(env);

  if (!env.S3_ENDPOINT || hasUnresolvedInterpolation(env.S3_ENDPOINT)) {
    env.S3_ENDPOINT = env.MINIO_URL;
  }

  return {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    minioUrl: env.MINIO_URL,
  };
}

// Run when executed directly: node scripts/resolve-env.mjs
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('resolve-env.mjs')) {
  const resolved = applyResolvedEnv();
  console.log(JSON.stringify(resolved, null, 2));
}
