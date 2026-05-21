/**
 * Phase 6 AI veterinary core verification.
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
    'src/modules/ai-veterinary-core/ai-veterinary-core.module.ts',
    'src/modules/ai-veterinary-core/ai-veterinary-core.service.ts',
    'src/modules/ai-veterinary-core/safety/ai-safety.guardrails.ts',
    'prisma/migrations/20260521210000_phase6_ai_veterinary_core/migration.sql',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'mount at /api/ai via ai-veterinary-core',
    fileContains('src/modules/index.ts', 'createAiVeterinaryCoreModule'),
  );
  push(
    'freeze',
    'legacy ai technician routes untouched',
    fileExists('src/legacy/web/routes/mobile/ai-technician/requests/route.ts'),
  );
  push(
    'safety',
    'no autonomous diagnosis policy in guardrails',
    fileContains(
      'src/modules/ai-veterinary-core/safety/ai-safety.guardrails.ts',
      'shouldRefuseUserInput',
    ),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', 'src/modules/ai-veterinary-core'],
    { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf8' },
  );
  push(
    'tests',
    'ai-veterinary-core unit tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== AI Veterinary Core Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
  console.log('\nAI_VETERINARY_VERIFY=PASS\n');
}

main();
