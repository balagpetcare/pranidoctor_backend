#!/usr/bin/env node
/**
 * Pre-deploy migration preflight (no migrate deploy).
 * Usage: npm run db:preflight
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { buildMigrationInventory } from './lib/migration-inventory.mjs';
import { BACKEND_ROOT } from './lib/paths.mjs';

function migrationsDirtyVsHead() {
  const gitDir = path.join(BACKEND_ROOT, '.git');
  if (!fs.existsSync(gitDir)) return false;
  const r = spawnSync('git diff --quiet HEAD -- prisma/migrations/', {
    cwd: BACKEND_ROOT,
    shell: true,
    encoding: 'utf8',
  });
  return r.status === 1;
}

function migrateStatus() {
  const r = spawnSync('npx prisma migrate status', {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  return { code: r.status, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[db:preflight] DATABASE_URL is required.');
    process.exit(1);
  }

  const inventory = buildMigrationInventory();
  if (inventory.duplicateTimestamps.length > 0) {
    console.warn(
      '[db:preflight] WARN: duplicate migration timestamps:',
      inventory.duplicateTimestamps,
    );
  }

  if (inventory.highRiskCount > 0) {
    console.warn(
      `[db:preflight] WARN: ${inventory.highRiskCount} high-risk migration(s) in chain — ensure backup before deploy`,
    );
  }

  if (migrationsDirtyVsHead()) {
    console.error('[db:preflight] FAIL: prisma/migrations differs from git HEAD');
    process.exit(1);
  }

  const st = migrateStatus();
  const combined = st.out;
  if (/Following migration have failed/i.test(combined)) {
    console.error('[db:preflight] FAIL: failed migrations reported by Prisma');
    console.error(combined);
    process.exit(1);
  }
  if (/drift detected/i.test(combined)) {
    console.error('[db:preflight] FAIL: schema drift detected');
    console.error(combined);
    process.exit(1);
  }

  const pendingOnly =
    st.code !== 0 &&
    /not yet been applied|pending migrations/i.test(combined);
  if (st.code !== 0 && !pendingOnly) {
    console.error('[db:preflight] FAIL: migrate status error');
    console.error(combined);
    process.exit(1);
  }

  console.log('[db:preflight] OK');
}

main();
