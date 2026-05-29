/**
 * Guards `prisma migrate deploy` against accidental wrong-database targets.
 * Canonical schema owner: pranidoctor-backend (see prisma/SCHEMA_OWNER.md).
 *
 * Set ALLOW_PRODUCTION_MIGRATE=true only on the production deploy host after backup.
 */
import { basename } from 'node:path';

const cmd = process.argv[2] ?? basename(process.env.npm_lifecycle_event ?? 'unknown');
const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';

if (!databaseUrl) {
  console.error(`[prisma-production-guard] BLOCKED: ${cmd} — DATABASE_URL is not set.`);
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(databaseUrl.replace(/^postgresql:/, 'postgres:'));
} catch {
  console.error(`[prisma-production-guard] BLOCKED: ${cmd} — DATABASE_URL is not a valid URL.`);
  process.exit(1);
}

const host = (parsed.hostname || '').toLowerCase();
const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

const looksProductionHost =
  host.includes('prod') ||
  host.includes('production') ||
  /\.(rds\.amazonaws\.com|neon\.tech|supabase\.co)$/.test(host);

const isLocalHost =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === 'postgres' ||
  host.endsWith('.local');

if (nodeEnv === 'production' && isLocalHost) {
  console.error(`
[prisma-production-guard] BLOCKED: ${cmd}

NODE_ENV=production but DATABASE_URL host is "${host}" (local/container default).
Point DATABASE_URL at the production PostgreSQL host before migrating.
`);
  process.exit(1);
}

if (looksProductionHost && process.env.ALLOW_PRODUCTION_MIGRATE !== 'true') {
  console.error(`
[prisma-production-guard] BLOCKED: ${cmd}

DATABASE_URL host "${host}" looks like production.
Take a backup first, then run with:

  ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy
`);
  process.exit(1);
}

console.info(`[prisma-production-guard] OK: ${cmd} on host ${host}`);
