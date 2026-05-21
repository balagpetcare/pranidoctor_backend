/**
 * End-to-end runtime verification for local/staging smoke tests.
 * Usage: npx tsx scripts/runtime-verification.ts [--base-url http://localhost:3000]
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';

loadEnvironment();

import { execSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

type Status = 'PASS' | 'FAIL' | 'SKIP';

interface CheckResult {
  id: string;
  status: Status;
  detail: string;
}

const baseUrl = process.argv.find((a) => a.startsWith('--base-url='))?.split('=')[1]
  ?? process.env['VERIFY_BASE_URL']
  ?? 'http://localhost:3000';

const results: CheckResult[] = [];

function record(id: string, status: Status, detail: string): void {
  results.push({ id, status, detail });
}

function runCommand(id: string, command: string): void {
  try {
    execSync(command, { stdio: 'pipe', cwd: process.cwd(), env: process.env });
    record(id, 'PASS', command);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(id, 'FAIL', message.split('\n')[0] ?? message);
  }
}

async function fetchCheck(
  id: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const snippet = text.length > 200 ? `${text.slice(0, 200)}...` : text;
    if (response.ok) {
      record(id, 'PASS', `HTTP ${response.status} — ${snippet}`);
    } else {
      record(id, 'FAIL', `HTTP ${response.status} — ${snippet}`);
    }
  } catch (error) {
    record(id, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

async function main(): Promise<void> {
  console.log('Prani Doctor — Runtime Verification');
  console.log(`Base URL: ${baseUrl}\n`);

  runCommand('prisma_generate', 'npx prisma generate');
  runCommand('migration_deploy', 'npx prisma migrate deploy');
  runCommand('db_seed', 'npm run db:seed');

  try {
    const { loadConfig } = await import('../src/shared/config/config.loader.js');
    const { createPrismaClient, checkDatabaseConnection, disconnectPrisma } = await import(
      '../src/shared/database/prisma.js'
    );
    const { createRedisClient, checkRedisConnection, disconnectRedis } = await import(
      '../src/infra/redis/redis.client.js'
    );
    const { initializeStorage, isStorageEnabled } = await import(
      '../src/infra/storage/storage.factory.js'
    );
    const { getStorage } = await import('../src/infra/storage/storage.factory.js');

    const config = loadConfig();
    createPrismaClient({ config });
    const db = await checkDatabaseConnection();
    record('db_connection', db.healthy ? 'PASS' : 'FAIL', db.error ?? `latency ${db.latency}ms`);

    try {
      createRedisClient({ config });
      const redis = await checkRedisConnection();
      record('redis_connection', redis.healthy ? 'PASS' : 'FAIL', redis.error ?? `latency ${redis.latency}ms`);
    } catch (error) {
      record('redis_connection', 'FAIL', error instanceof Error ? error.message : String(error));
    }

    if (isStorageEnabled(config)) {
      initializeStorage(config);
      const storage = getStorage();
      const health = await storage.checkHealth();
      record(
        'storage_health',
        health.healthy ? 'PASS' : 'FAIL',
        health.error ?? `latency ${health.latency ?? 0}ms`
      );
    } else {
      record('storage_health', 'SKIP', 'STORAGE_DRIVER=disabled');
    }

    await disconnectRedis();
    await disconnectPrisma();
  } catch (error) {
    record('infra_validation', 'FAIL', error instanceof Error ? error.message : String(error));
  }

  await delay(500);

  await fetchCheck('GET /health', 'GET', '/health');
  await fetchCheck('POST /health', 'POST', '/health');
  await fetchCheck('GET /ready', 'GET', '/ready');
  await fetchCheck('GET /health/dependencies', 'GET', '/health/dependencies');

  const testPhone = '+8801712345678';

  await fetchCheck('POST /api/auth/otp/request', 'POST', '/api/auth/otp/request', { phone: testPhone });
  await fetchCheck('POST /api/auth/login (alias)', 'POST', '/api/auth/login', {
    phone: testPhone,
    code: '000000',
  });
  await fetchCheck('POST /api/auth/refresh (alias)', 'POST', '/api/auth/refresh', {
    refreshToken: 'invalid-token-for-smoke-test',
  });
  await fetchCheck('GET /api/media (module load)', 'GET', '/api/media/nonexistent-file');

  console.log('\n| Check | Status | Detail |');
  console.log('|-------|--------|--------|');
  for (const row of results) {
    const detail = row.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    console.log(`| ${row.id} | ${row.status} | ${detail.slice(0, 120)} |`);
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  console.log(`\nSummary: PASS=${pass} FAIL=${fail} SKIP=${skip}`);

  const critical = [
    'migration_deploy',
    'db_seed',
    'db_connection',
    'redis_connection',
    'GET /health',
    'POST /health',
    'POST /api/auth/otp/request',
  ];
  const criticalFail = results.some((r) => critical.includes(r.id) && r.status === 'FAIL');
  process.exit(criticalFail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
