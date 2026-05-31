/**
 * Verifies legacy ai-ops route modules load without ERR_MODULE_NOT_FOUND.
 * Usage: npx tsx scripts/ops/verify-ai-ops-route-imports.mjs
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROUTES_ROOT = join(import.meta.dirname, '../../src/legacy/web/routes/admin/ai-ops');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name === 'route.ts') files.push(full);
  }
  return files;
}

const targets = new Set(
  [
    'models/[id]/enable/route.ts',
    'models/[id]/disable/route.ts',
    'models/families/route.ts',
    'models/sync/manifests/route.ts',
    'models/[id]/route.ts',
    'marketplace/extensions/route.ts',
    'marketplace/adapters/route.ts',
    'marketplace/veterinary/models/route.ts',
    'marketplace/models/external/route.ts',
    'marketplace/openrouter/sync/route.ts',
  ].map((p) => p.replace(/\//g, '\\')),
);

let failed = 0;
for (const file of walk(ROUTES_ROOT)) {
  const rel = relative(ROUTES_ROOT, file);
  if (!targets.has(rel)) continue;
  try {
    await import(pathToFileURL(file).href);
    console.log(`OK  ${rel}`);
  } catch (error) {
    failed += 1;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${rel}\n      ${msg}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`\nAll ${targets.size} targeted route modules loaded.`);
