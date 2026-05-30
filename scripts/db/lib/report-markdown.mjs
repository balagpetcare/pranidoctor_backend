/**
 * @param {ReturnType<import('./migration-inventory.mjs').buildMigrationInventory>} inventory
 */
export function migrationAuditMarkdown(inventory) {
  const lines = [
    '# Migration Audit Report',
    '',
    `**Generated:** ${inventory.generatedAt}  `,
    `**Migration count:** ${inventory.migrationCount}  `,
    `**High-risk (P0/P1):** ${inventory.highRiskCount}  `,
    `**Non-reversible:** ${inventory.nonReversibleCount}  `,
    '',
    '## Duplicate timestamps',
    '',
  ];
  if (inventory.duplicateTimestamps.length === 0) {
    lines.push('_None (same second-resolution prefix with distinct folder names is OK)._', '');
  } else {
    for (const d of inventory.duplicateTimestamps) {
      lines.push(`- \`${d.timestamp}\`: ${d.folders.join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## High-risk migrations', '', '| Folder | Max severity | Flags |', '|--------|--------------|-------|');
  for (const e of inventory.entries.filter((x) => x.safety.maxSeverity === 'P0' || x.safety.maxSeverity === 'P1')) {
    const flags = e.safety.findings.map((f) => f.id).join(', ');
    lines.push(`| ${e.folder} | ${e.safety.maxSeverity} | ${flags} |`);
  }
  lines.push('', '## Full inventory', '', '| # | Folder | Severity | Reversible |', '|---|--------|----------|------------|');
  inventory.entries.forEach((e, i) => {
    lines.push(
      `| ${i + 1} | ${e.folder} | ${e.safety.maxSeverity} | ${e.safety.reversible ? 'yes' : '**no**'} |`,
    );
  });
  return lines.join('\n');
}

export function schemaDriftMarkdown(drifts) {
  const lines = [
    '# Schema Drift Report',
    '',
    `**Generated:** ${new Date().toISOString()}  `,
    '',
  ];
  if (!drifts.length) {
    lines.push('_No environment comparisons run. Use `DATABASE_URL_*` env vars or snapshot JSON files._', '');
    return lines.join('\n');
  }
  for (const d of drifts) {
    lines.push(`## ${d.expectedLabel} → ${d.actualLabel}`, '');
    if (!d.driftDetected) {
      lines.push('**Result:** No drift detected', '');
      continue;
    }
    lines.push('**Result:** DRIFT DETECTED', '');
    lines.push('```json');
    lines.push(JSON.stringify(d.summary, null, 2));
    lines.push('```', '');
    if (d.missingTables.length) {
      lines.push('### Missing tables', '', d.missingTables.map((t) => `- ${t}`).join('\n'), '');
    }
    if (d.columnIssues.length) {
      lines.push('### Column issues (sample)', '');
      for (const c of d.columnIssues.slice(0, 30)) {
        lines.push(`- ${c.table}.${c.column}: ${c.issue}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function rollbackReadinessMarkdown(inventory, backup) {
  return [
    '# Rollback Procedures',
    '',
    '**Prisma migrations are forward-only.** Production rollback is **application image revert** or **database restore from backup** — not `migrate down`.',
    '',
    '## Quick decision matrix',
    '',
    '| Symptom | Action |',
    '|---------|--------|',
    '| 5xx after deploy, schema unchanged | Redeploy previous API image |',
    '| migrate deploy failed | Stop traffic; fix forward or restore backup |',
    '| Data corruption | Stop writes; restore from pre-migrate backup |',
    '',
    '## Non-reversible migrations in chain',
    '',
    `Count: **${inventory.nonReversibleCount}** (DROP COLUMN, DELETE, DROP TABLE, type changes)`,
    '',
    ...inventory.nonReversibleFolders.map((f) => `- \`${f}\``),
    '',
    '## Backup scripts',
    '',
    `- Backup: \`scripts/backup/postgres-backup.sh\` — exists: ${backup.scripts.backupExists}`,
    `- Restore: \`scripts/backup/postgres-restore.sh\` — exists: ${backup.scripts.restoreExists}`,
    '',
    '## Restore validation (no production writes)',
    '',
    '1. Restore to `pranidoctor_restore_test` database',
    '2. Run `npm run db:snapshot -- --label restore-test`',
    '3. Compare row counts vs production metrics',
    '4. Smoke OTP + SR list',
    '',
    'See `pranidoctor_user/docs/launch/ROLLBACK_PLAN.md` for full ops steps.',
    '',
    `**Report generated:** ${inventory.generatedAt}`,
  ].join('\n');
}

export function safetyChecklistMarkdown() {
  return [
    '# Migration Safety Checklist',
    '',
    'Use before every release with new `prisma/migrations/*` folders.',
    '',
    '## Pre-migrate',
    '',
    '- [ ] `npm run db:audit` — review high-risk table',
    '- [ ] `npm run db:preflight` on target host (DATABASE_URL set)',
    '- [ ] `postgres-backup.sh` completed; `gzip -t` on artifact',
    '- [ ] Staging `migrate deploy` applied and smoke tests pass',
    '- [ ] `ALLOW_PRODUCTION_MIGRATE=true` only on production host',
    '',
    '## Automated rules (CI)',
    '',
    '| Rule ID | Severity | Pattern |',
    '|---------|----------|---------|',
    '| DROP_TABLE | P0 | DROP TABLE |',
    '| DROP_COLUMN | P1 | DROP COLUMN |',
    '| DELETE_ROWS | P1 | DELETE FROM |',
    '| ALTER_TYPE | P1 | ALTER COLUMN TYPE |',
    '| SET_NOT_NULL | P2 | SET NOT NULL |',
    '',
    '## Post-migrate',
    '',
    '- [ ] `npx prisma migrate status` — up to date',
    '- [ ] `GET /ready` OK',
    '- [ ] Optional: `npm run db:validate` with seed checks',
    '',
    '## Forbidden on shared environments',
    '',
    '- `npm run db:push`',
    '- `prisma migrate reset` on staging/production',
    '- Editing applied migration SQL in place',
    '',
  ].join('\n');
}
