#!/usr/bin/env node
/**
 * Capture read-only schema snapshot JSON.
 * Usage: DATABASE_URL=... npm run db:snapshot -- --label staging
 */
import fs from 'node:fs';

import { introspectSchema } from './lib/schema-introspect.mjs';
import { ensureDir, REPORTS_DIR } from './lib/paths.mjs';

const args = process.argv.slice(2);
const labelIdx = args.indexOf('--label');
const label = labelIdx >= 0 ? args[labelIdx + 1] : process.env.SCHEMA_SNAPSHOT_LABEL ?? 'local';

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const snapshot = await introspectSchema(url, label);
  ensureDir(REPORTS_DIR);
  const out = `${REPORTS_DIR}/schema-${label}.json`;
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${out} (${snapshot.tableCount} tables)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
