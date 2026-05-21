/**
 * Phase 2 area engine verification — structure, freeze boundaries, unit tests.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');

interface Check {
  area: string;
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  checks.push({ area, name, ok, detail });
}

function fileExists(rel: string): boolean {
  return existsSync(join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').includes(needle);
}

function verifyStructure(): void {
  const required = [
    'src/modules/area-engine/area-engine.module.ts',
    'src/modules/area-engine/repository/area.repository.ts',
    'src/modules/area-engine/search/area-search.service.ts',
    'src/modules/area-engine/cache/area-cache.service.ts',
    'src/modules/area-engine/seed/area-seed.service.ts',
    'scripts/area-seed.ts',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'modules/area not modified (new area-engine module)',
    fileExists('src/modules/area/area-catalog.service.ts') &&
      fileContains('src/modules/index.ts', 'createAreaEngineModule'),
  );
  push(
    'freeze',
    'additive mount at /api/area',
    fileContains('src/modules/area-engine/area-engine.module.ts', "name: 'area'"),
  );
  push(
    'freeze',
    'legacy locations routes untouched',
    fileContains('src/legacy/web/routes/locations/divisions/route.ts', 'listDivisionsMaster'),
  );
}

function runTests(): void {
  const result = spawnSync('npm', ['run', 'test', '--', '--run', 'src/modules/area-engine'], {
    cwd: ROOT,
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  push(
    'tests',
    'area-engine unit tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== Area Engine Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
  console.log('\nAREA_ENGINE_VERIFY=PASS\n');
}

main();
