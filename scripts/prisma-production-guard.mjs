/**
 * Blocks Prisma migrate/seed/push against production-owned schema.
 * Production DB + migrations: pranidoctor-web only.
 * This repo (staging mirror) may run: npm run db:generate
 */
import { basename } from 'node:path';

const cmd = process.argv[2] ?? basename(process.env.npm_lifecycle_event ?? 'unknown');

console.error(`
[prisma-production-guard] BLOCKED: ${cmd}

Prisma schema and migrations are owned by PRODUCTION:
  D:\\PraniDoctor\\pranidoctor-web

This STAGING mirror must not apply migrations or seed shared databases.

Allowed in pranidoctor-backend:
  npm run db:generate     # local Prisma client for Express dev

Run from pranidoctor-web instead:
  npm run db:migrate
  npm run db:deploy:safe  (or prisma migrate deploy)
  npm run db:seed

To refresh mirror files from production (optional, local only):
  ..\\pranidoctor-web\\scripts\\sync-prisma-mirror-to-backend.ps1
`);

process.exit(1);
