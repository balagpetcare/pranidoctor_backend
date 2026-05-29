/**
 * AI usage monitoring verification — structural checks + test runner.
 * Usage: npm run ai:usage-verify
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
    'src/modules/ai/usage/ai-usage.service.ts',
    'src/modules/ai/usage/ai-usage.cost.ts',
    'src/modules/ai/usage/ai-usage.metrics.ts',
    'src/modules/ai/usage/ai-usage.tokens.ts',
    'src/modules/ai/usage/ai-usage.rollups.ts',
    'src/modules/ai/usage/ai-usage.errors.ts',
    'src/modules/ai/orchestrator/ai-orchestrator.service.ts',
    'prisma/migrations/20260530120000_ai_usage_monitoring/migration.sql',
    'prisma/migrations/20260530140000_ai_token_tracking/migration.sql',
  ];
  for (const rel of required) {
    push('structure', rel, fileExists(rel));
  }

  push(
    'structure',
    'AiUsageUserDailyRollup in schema',
    fileContains('prisma/schema.prisma', 'model AiUsageUserDailyRollup'),
  );
  push(
    'structure',
    'AiUsageCustomerDailyRollup in schema',
    fileContains('prisma/schema.prisma', 'model AiUsageCustomerDailyRollup'),
  );
  push(
    'structure',
    'AiUsageRecord totalTokens + billable',
    fileContains('prisma/schema.prisma', 'totalTokens') &&
      fileContains('prisma/schema.prisma', 'billable'),
  );
}

function verifyWiring(): void {
  push(
    'wiring',
    'orchestrator resolves customerId from userId',
    fileContains(
      'src/modules/ai/orchestrator/ai-orchestrator.service.ts',
      'resolveCustomerId',
    ),
  );
  push(
    'wiring',
    'user/customer consumption APIs',
    fileContains('src/modules/ai/usage/ai-usage.service.ts', 'getUserConsumption') &&
      fileContains('src/modules/ai/usage/ai-usage.service.ts', 'getCustomerConsumption'),
  );
  push(
    'wiring',
    '/metrics exports ai_requests_total',
    fileContains('src/api/metrics/metrics.routes.ts', 'renderAiUsagePrometheusLines'),
  );
  push(
    'wiring',
    'analytics overview includes usage summary',
    fileContains(
      'src/modules/ai/analytics/ai-analytics.service.ts',
      'getUsageSummary',
    ),
  );
  push(
    'wiring',
    'daily rollup upsert on persist',
    fileContains('src/modules/ai/usage/ai-usage.service.ts', 'aiUsageDailyRollup.upsert'),
  );
}

function runTests(): void {
  const result = spawnSync(
    'npm',
    [
      'run',
      'test',
      '--',
      'src/modules/ai/usage/ai-usage.unit.test.ts',
      'src/modules/ai/usage/ai-usage.tokens.unit.test.ts',
      'src/modules/ai/usage/ai-token-tracking.verify.test.ts',
      'src/modules/ai/usage/ai-usage-monitoring.verify.test.ts',
    ],
    { cwd: ROOT, shell: true, stdio: 'pipe', encoding: 'utf8' },
  );
  push(
    'tests',
    'AI usage unit + verification tests',
    result.status === 0,
    result.status === 0
      ? undefined
      : `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-1200),
  );
}

function main(): void {
  verifyStructure();
  verifyWiring();
  runTests();

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== AI Usage Monitoring Verification ===\n');
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'} [${c.area}] ${c.name}${c.detail ? `\n       ${c.detail}` : ''}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);

  if (failed.length > 0) process.exit(1);
}

main();
