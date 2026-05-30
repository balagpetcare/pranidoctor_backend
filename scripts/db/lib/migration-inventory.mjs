import fs from 'node:fs';
import path from 'node:path';

import { MIGRATIONS_DIR, readMigrationFolders } from './paths.mjs';
import { analyzeMigrationSql } from './migration-safety.mjs';

/**
 * Build migration inventory: ordering, duplicates, safety flags.
 * @returns {import('./types.js').MigrationInventory}
 */
export function buildMigrationInventory() {
  const folders = readMigrationFolders();
  const entries = [];
  const timestampGroups = new Map();

  for (const folder of folders) {
    const sqlPath = path.join(MIGRATIONS_DIR, folder, 'migration.sql');
    const sql = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '';
    const match = /^(\d{14})_(.+)$/.exec(folder);
    const timestamp = match?.[1] ?? folder;
    const name = match?.[2] ?? folder;
    const safety = analyzeMigrationSql(sql, folder);

    if (!timestampGroups.has(timestamp)) timestampGroups.set(timestamp, []);
    timestampGroups.get(timestamp).push(folder);

    entries.push({
      folder,
      timestamp,
      name,
      sqlBytes: Buffer.byteLength(sql, 'utf8'),
      safety,
    });
  }

  const duplicateTimestamps = [...timestampGroups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([timestamp, folders]) => ({ timestamp, folders }));

  const highRisk = entries.filter((e) => e.safety.maxSeverity === 'P0' || e.safety.maxSeverity === 'P1');
  const nonReversible = entries.filter((e) => e.safety.nonReversible);

  return {
    generatedAt: new Date().toISOString(),
    migrationCount: entries.length,
    entries,
    duplicateTimestamps,
    orderingValid: folders.every((f, i) => f === [...folders].sort()[i]),
    highRiskCount: highRisk.length,
    nonReversibleCount: nonReversible.length,
    highRiskFolders: highRisk.map((e) => e.folder),
    nonReversibleFolders: nonReversible.map((e) => e.folder),
  };
}
