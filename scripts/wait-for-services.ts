/**
 * Wait for infrastructure TCP ports before migrations / dev server.
 * Default: PostgreSQL only (no Docker required).
 * Override: WAIT_FOR=postgres,redis,minio
 */
import { createConnection } from 'net';

import { loadEnvironment } from '../src/shared/config/load-env.js';
import { resolveDatabaseUrl, resolveMinioUrl, resolveRedisUrl } from '../src/shared/config/env.resolver.js';

loadEnvironment();

interface WaitTarget {
  name: string;
  host: string;
  port: number;
}

function parseHostPort(url: string, defaultPort: number): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : defaultPort,
    };
  } catch {
    return { host: 'localhost', port: defaultPort };
  }
}

function getTargets(): WaitTarget[] {
  const waitFor = (process.env['WAIT_FOR'] ?? 'postgres')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const targets: WaitTarget[] = [];

  if (waitFor.includes('postgres') || waitFor.includes('db')) {
    const db = parseHostPort(resolveDatabaseUrl(), 5432);
    targets.push({ name: 'postgres', host: db.host, port: db.port });
  }

  if (waitFor.includes('redis')) {
    const redis = parseHostPort(resolveRedisUrl(), 6379);
    targets.push({ name: 'redis', host: redis.host, port: redis.port });
  }

  if (waitFor.includes('minio') || waitFor.includes('storage')) {
    const minio = parseHostPort(resolveMinioUrl(), 9000);
    targets.push({ name: 'minio', host: minio.host, port: minio.port });
  }

  return targets;
}

function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForService(
  target: WaitTarget,
  maxAttempts: number,
  delayMs: number
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await waitForPort(target.host, target.port, 2000);
    if (ok) {
      console.log(`✓ ${target.name} ready (${target.host}:${target.port})`);
      return;
    }

    if (attempt === maxAttempts) {
      throw new Error(
        `${target.name} not ready after ${maxAttempts} attempts (${target.host}:${target.port})`
      );
    }

    console.log(
      `  waiting for ${target.name} (${target.host}:${target.port}) attempt ${attempt}/${maxAttempts}...`
    );
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function main(): Promise<void> {
  const maxAttempts = Number(process.env['WAIT_MAX_ATTEMPTS'] ?? 30);
  const delayMs = Number(process.env['WAIT_DELAY_MS'] ?? 2000);
  const targets = getTargets();

  if (targets.length === 0) {
    console.log('No services to wait for (WAIT_FOR empty).');
    return;
  }

  console.log(
    `Waiting for: ${targets.map((t) => t.name).join(', ')} (set WAIT_FOR=postgres,redis,minio to extend)`
  );

  for (const target of targets) {
    await waitForService(target, maxAttempts, delayMs);
  }

  console.log('All requested services are reachable.');
}

main().catch((error) => {
  console.error('Service wait failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
