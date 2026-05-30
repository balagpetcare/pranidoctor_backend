#!/usr/bin/env node
import 'dotenv/config';
/**
 * Full migration validation — writes reports to reports/db/ and user docs/database/.
 * Usage:
 *   npm run db:audit        # filesystem only
 *   npm run db:validate     # + DB checks when DATABASE_URL set
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildMigrationInventory } from './lib/migration-inventory.mjs';
import { verifyBackupInfrastructure, verifyPgToolsAvailable } from './lib/backup-verify.mjs';
import { validateSeedData } from './lib/seed-validate.mjs';
import { introspectSchema } from './lib/schema-introspect.mjs';
import { compareSchemaSnapshots } from './lib/schema-compare.mjs';
import {
  migrationAuditMarkdown,
  schemaDriftMarkdown,
  rollbackReadinessMarkdown,
  safetyChecklistMarkdown,
} from './lib/report-markdown.mjs';
import { ensureDir, REPORTS_DIR, userDatabaseDocsDir, BACKEND_ROOT } from './lib/paths.mjs';

const auditOnly = process.argv.includes('--audit-only');

async function compareEnvSnapshots() {
  const pairs = [
    ['local', process.env.DATABASE_URL_LOCAL],
    ['development', process.env.DATABASE_URL_DEVELOPMENT],
    ['staging', process.env.DATABASE_URL_STAGING],
    ['production', process.env.DATABASE_URL_PRODUCTION],
  ].filter(([, url]) => url?.trim());

  /** @type {Record<string, object>} */
  const snapshots = {};
  for (const [label, url] of pairs) {
    snapshots[label] = await introspectSchema(url.trim(), label);
    ensureDir(REPORTS_DIR);
    fs.writeFileSync(
      `${REPORTS_DIR}/schema-${label}.json`,
      JSON.stringify(snapshots[label], null, 2),
    );
  }

  const drifts = [];
  const order = ['local', 'development', 'staging', 'production'].filter((l) => snapshots[l]);
  for (let i = 1; i < order.length; i++) {
    const expected = snapshots[order[i - 1]];
    const actual = snapshots[order[i]];
    drifts.push(compareSchemaSnapshots(expected, actual));
  }

  if (snapshots.local && snapshots.production && !pairs.some(([l]) => l === 'development')) {
    /* explicit local vs prod when both set */
  }

  return drifts;
}

function prismaValidate() {
  const r = spawnSync('npx prisma validate', {
    cwd: BACKEND_ROOT,
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

async function main() {
  ensureDir(REPORTS_DIR);
  const userDocs = userDatabaseDocsDir();
  try {
    ensureDir(userDocs);
  } catch {
    /* sibling repo optional */
  }

  const inventory = buildMigrationInventory();
  const backup = verifyBackupInfrastructure({ backupDir: process.env.BACKUP_VERIFY_DIR });
  const pgTools = verifyPgToolsAvailable();
  const prismaVal = prismaValidate();

  fs.writeFileSync(`${REPORTS_DIR}/migration-inventory.json`, JSON.stringify(inventory, null, 2));

  const auditMd = migrationAuditMarkdown(inventory);
  fs.writeFileSync(`${REPORTS_DIR}/migration-audit-report.md`, auditMd);
  try {
    fs.writeFileSync(`${userDocs}/migration-audit-report.md`, auditMd);
  } catch {
    /* optional */
  }

  const rollbackMd = rollbackReadinessMarkdown(inventory, backup);
  fs.writeFileSync(`${REPORTS_DIR}/rollback-procedures.md`, rollbackMd);
  try {
    fs.writeFileSync(`${userDocs}/rollback-procedures.md`, rollbackMd);
  } catch {
    /* optional */
  }

  const checklistMd = safetyChecklistMarkdown();
  fs.writeFileSync(`${REPORTS_DIR}/migration-safety-checklist.md`, checklistMd);
  try {
    fs.writeFileSync(`${userDocs}/migration-safety-checklist.md`, checklistMd);
  } catch {
    /* optional */
  }

  /** @type {object} */
  const summary = {
    generatedAt: new Date().toISOString(),
    auditOnly,
    inventory: {
      count: inventory.migrationCount,
      highRisk: inventory.highRiskCount,
      nonReversible: inventory.nonReversibleCount,
      duplicateTimestamps: inventory.duplicateTimestamps.length,
    },
    prismaValidate: prismaVal,
    backup,
    pgTools,
    seed: null,
    drift: [],
    exitCode: 0,
  };

  if (!auditOnly && process.env.DATABASE_URL?.trim()) {
    try {
      summary.seed = await validateSeedData(process.env.DATABASE_URL.trim());
      if (!summary.seed.ok) summary.exitCode = 1;
    } catch (e) {
      summary.seed = { ok: false, error: e instanceof Error ? e.message : String(e) };
      summary.exitCode = 1;
    }
  }

  if (!auditOnly) {
    const hasMulti =
      process.env.DATABASE_URL_LOCAL ||
      process.env.DATABASE_URL_STAGING ||
      process.env.DATABASE_URL_PRODUCTION;
    if (hasMulti) {
      try {
        summary.drift = await compareEnvSnapshots();
        const driftMd = schemaDriftMarkdown(summary.drift);
        fs.writeFileSync(`${REPORTS_DIR}/schema-drift-report.md`, driftMd);
        try {
          fs.writeFileSync(`${userDocs}/schema-drift-report.md`, driftMd);
        } catch {
          /* optional */
        }
        if (summary.drift.some((d) => d.driftDetected)) summary.exitCode = 1;
      } catch (e) {
        summary.driftError = e instanceof Error ? e.message : String(e);
        summary.exitCode = 1;
      }
    } else {
      const driftMd = schemaDriftMarkdown([]);
      driftMd +=
        '\n\n## How to run comparisons\n\nSet `DATABASE_URL_LOCAL`, `DATABASE_URL_STAGING`, `DATABASE_URL_PRODUCTION` (or use `npm run db:snapshot` + `db:compare-schema`).\n';
      fs.writeFileSync(`${REPORTS_DIR}/schema-drift-report.md`, driftMd);
      try {
        fs.writeFileSync(`${userDocs}/schema-drift-report.md`, driftMd);
      } catch {
        /* optional */
      }
    }
  }

  if (!prismaVal.ok) {
    summary.exitCode = auditOnly ? summary.exitCode : 1;
    if (auditOnly) summary.prismaValidateWarning = 'prisma validate failed in audit-only mode';
  }

  fs.writeFileSync(`${REPORTS_DIR}/validation-summary.json`, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
