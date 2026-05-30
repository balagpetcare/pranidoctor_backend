#!/usr/bin/env node
/**
 * Compare two snapshot JSON files.
 * Usage: npm run db:compare-schema -- --expected reports/db/schema-staging.json --actual reports/db/schema-production.json
 */
import fs from 'node:fs';

import { compareSchemaSnapshots } from './lib/schema-compare.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const expectedPath = arg('--expected');
  const actualPath = arg('--actual');
  if (!expectedPath || !actualPath) {
    console.error('Usage: --expected <file> --actual <file>');
    process.exit(1);
  }
  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  const actual = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
  const diff = compareSchemaSnapshots(expected, actual);
  console.log(JSON.stringify(diff, null, 2));
  process.exit(diff.driftDetected ? 1 : 0);
}

main();
