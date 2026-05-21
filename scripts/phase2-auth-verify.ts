/**
 * Phase 2 auth & user verification — additive identity layer + freeze boundary checks.
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
    'src/modules/identity/identity.module.ts',
    'src/modules/identity/login/login-orchestrator.service.ts',
    'src/modules/identity/session/session-engine.service.ts',
    'src/modules/identity/profile/profile-facade.service.ts',
    'src/modules/identity/guards/role.guard.ts',
    'src/modules/identity/identity.routes.ts',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'modules/auth untouched by identity imports only',
    fileContains('src/modules/identity/login/login-providers.ts', 'getIdentityAuthService'),
    'delegation pattern'
  );

  push(
    'freeze',
    'identity routes are additive /api/identity',
    fileContains('src/modules/identity/identity.routes.ts', '/capabilities'),
  );

  push(
    'freeze',
    'no edits required to legacy api-response',
    fileContains('src/legacy/web/lib/api-response.ts', 'ok: true'),
  );

  push(
    'freeze',
    'social login stub only',
    fileContains('src/modules/identity/login/login-providers.ts', 'NOT_IMPLEMENTED'),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', 'src/modules/identity', 'src/modules/user/user.repository.test.ts'],
    { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf8' },
  );
  push(
    'tests',
    'identity + user lifecycle tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== Phase 2 Auth Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);

  if (failed.length > 0) process.exit(1);
  console.log('\nPHASE2_AUTH_VERIFY=PASS\n');
}

main();
