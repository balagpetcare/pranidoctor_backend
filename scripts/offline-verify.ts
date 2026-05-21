/**
 * Phase 8 offline architecture verification.
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
    'src/modules/offline-architecture/sync.module.ts',
    'src/modules/offline-architecture/offline.module.ts',
    'src/modules/offline-architecture/sync/sync-engine.service.ts',
    'src/modules/offline-architecture/retry/retry-engine.ts',
    'prisma/migrations/20260521230000_phase8_offline_architecture/migration.sql',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'sync module mounted at /api/sync',
    fileContains('src/modules/offline-architecture/sync.module.ts', "name: 'sync'"),
  );
  push(
    'freeze',
    'offline module mounted at /api/offline',
    fileContains('src/modules/offline-architecture/offline.module.ts', "name: 'offline'"),
  );
  push(
    'freeze',
    'no assignment on offline lead',
    fileContains(
      'src/modules/offline-architecture/repository/offline.repository.ts',
      'assignedAdminId',
    ) === false &&
      fileContains(
        'src/modules/offline-architecture/repository/offline.repository.ts',
        'LeadStatus.NEW',
      ),
  );
  push(
    'retry',
    'max retry attempts bounded',
    fileContains('src/modules/offline-architecture/retry/retry-engine.ts', 'OFFLINE_MAX_RETRY_ATTEMPTS'),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', 'src/modules/offline-architecture'],
    { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf8' },
  );
  push(
    'tests',
    'offline-architecture unit tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== Offline Architecture Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
  console.log('\nOFFLINE_ARCHITECTURE_VERIFY=PASS\n');
}

main();
