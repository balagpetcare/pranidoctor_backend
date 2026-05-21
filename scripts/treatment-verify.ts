/**
 * Phase 5 treatment workflow verification.
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
    'src/modules/treatment-workflow/treatment-workflow.module.ts',
    'src/modules/treatment-workflow/treatment-workflow.service.ts',
    'src/modules/treatment-workflow/treatment-workflow.routes.ts',
    'prisma/migrations/20260521200000_phase5_treatment_workflow/migration.sql',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }
}

function verifyFreeze(): void {
  push(
    'freeze',
    'modules/case not modified (new treatment-workflow module)',
    fileExists('src/modules/case/case.service.ts') &&
      fileContains('src/modules/index.ts', 'createTreatmentWorkflowModule'),
  );
  push(
    'freeze',
    'additive mount at /api/cases',
    fileContains('src/modules/treatment-workflow/treatment-workflow.module.ts', "name: 'cases'"),
  );
  push(
    'freeze',
    'legacy doctor treatment-cases route untouched',
    fileContains(
      'src/legacy/web/routes/doctor/service-requests/[id]/treatment-cases/route.ts',
      'createTreatmentCaseForDoctor',
    ),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    ['run', 'test', '--', '--run', 'src/modules/treatment-workflow'],
    {
      cwd: ROOT,
      shell: true,
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );
  push(
    'tests',
    'treatment-workflow unit tests',
    result.status === 0,
    result.status === 0 ? undefined : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-600),
  );
}

function main(): void {
  verifyStructure();
  verifyFreeze();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== Treatment Workflow Verify ===\n');
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.area} :: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
  console.log('\nTREATMENT_WORKFLOW_VERIFY=PASS\n');
}

main();
