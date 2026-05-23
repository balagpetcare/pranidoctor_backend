/**
 * Backend foundation verification — static + unit gates (no live services required).
 * Complements p1/p2/p3 verify scripts; does not replace them.
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

function fileExists(relativePath: string): boolean {
  return existsSync(join(ROOT, relativePath));
}

function fileContains(relativePath: string, needle: string): boolean {
  const path = join(ROOT, relativePath);
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').includes(needle);
}

function verifyStaticStructure(): void {
  const required = [
    'src/shared/config/config.schema.ts',
    'src/shared/config/load-env.ts',
    'src/shared/validation/validate.middleware.ts',
    'src/shared/logger/logger.ts',
    'src/shared/errors/error.handler.ts',
    'src/shared/utils/response.ts',
    'src/infra/redis/redis.client.ts',
    'src/infra/queue/queue.service.ts',
    'src/api/health/health.routes.ts',
    'src/shared/security/audit/audit.service.ts',
    'src/shared/foundation/index.ts',
    'docker/Dockerfile',
    'docker-compose.yml',
    '.env.example',
  ];

  for (const rel of required) {
    push('structure', rel, fileExists(rel), fileExists(rel) ? undefined : 'missing');
  }
}

function verifyFreezeBoundaries(): void {
  push(
    'freeze',
    'legacy api-response untouched (ok envelope)',
    fileContains('src/legacy/web/lib/api-response.ts', 'ok: true'),
    'DO_NOT_TOUCH contract surface'
  );

  push(
    'freeze',
    'foundation response uses success envelope',
    fileContains('src/shared/utils/response.ts', 'success: true'),
    'separate from legacy { ok, data }'
  );

  push(
    'freeze',
    'error handler uses foundation envelope',
    fileContains('src/shared/errors/error.handler.ts', 'success: false'),
    'compat routes keep own handlers'
  );

  push(
    'freeze',
    'legacy excluded from production build',
    fileContains('tsconfig.build.json', 'src/legacy/**'),
    'R-001 documented — prod Docker needs legacy compile pipeline'
  );
}

function verifyRedisHealthGraceful(): void {
  push(
    'redis',
    'checkRedisConnection handles uninitialized client',
    fileContains('src/infra/redis/redis.client.ts', 'if (!isRedisInitialized())'),
  );

  push(
    'health',
    'readiness respects REDIS_ENABLED',
    fileContains('src/api/health/health.service.ts', 'isRedisEnabled(config)'),
  );
}

function verifyStorageHealthGraceful(): void {
  push(
    'storage',
    'runtime degrade helper exists',
    fileContains('src/modules/media/storage/storage.factory.ts', 'degradeStorageRuntime'),
  );

  push(
    'health',
    'storage health returns degraded when optional',
    fileContains('src/api/health/health.service.ts', 'isStorageRuntimeDegraded'),
  );
}

function runUnitTests(): void {
  const result = spawnSync('npm', ['run', 'test', '--', '--run', 'src/shared', 'src/infra/redis'], {
    cwd: ROOT,
    shell: true,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  push(
    'tests',
    'foundation unit tests (shared + redis)',
    result.status === 0,
    result.status === 0 ? undefined : output.slice(-800)
  );
}

function main(): void {
  verifyStaticStructure();
  verifyFreezeBoundaries();
  verifyRedisHealthGraceful();
  verifyStorageHealthGraceful();
  runUnitTests();

  const failed = checks.filter((c) => !c.ok);

  console.log('\n=== Backend Foundation Verify ===\n');
  for (const check of checks) {
    const mark = check.ok ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${check.area} :: ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  console.log(`\nTotal: ${checks.length - failed.length}/${checks.length} passed`);

  if (failed.length > 0) {
    process.exit(1);
  }

  console.log('\nBACKEND_FOUNDATION_VERIFY=PASS\n');
}

main();
