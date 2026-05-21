/**
 * E2E freeze verification — web → backend → dependencies.
 * Run with backend up: npm run dev (port 3000)
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const WEB =
  process.env.WEB_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'http://localhost:3001';

type Check = {
  name: string;
  layer: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

const results: Check[] = [];

async function probe(
  name: string,
  layer: string,
  url: string,
  expectOk: (status: number, body: unknown) => boolean,
): Promise<void> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    const ok = expectOk(res.status, body);
    results.push({
      name,
      layer,
      ok,
      status: res.status,
      detail: ok ? undefined : JSON.stringify(body)?.slice(0, 200),
    });
  } catch (error) {
    results.push({
      name,
      layer,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main(): Promise<void> {
  console.log(`Backend: ${BACKEND}`);
  console.log(`Web: ${WEB}`);

  await probe('GET /health', 'backend', `${BACKEND}/health`, (s, b) => s === 200 || s === 503);
  await probe('GET /health/db', 'backend→db', `${BACKEND}/health/db`, (s) => s === 200 || s === 503);
  await probe('GET /health/redis', 'backend→redis', `${BACKEND}/health/redis`, (s) => s === 200 || s === 503);
  await probe(
    'GET /health/storage',
    'backend→storage',
    `${BACKEND}/health/storage`,
    (s) => s === 200 || s === 503,
  );
  await probe('GET /health/modules', 'backend', `${BACKEND}/health/modules`, (s, b) => {
    const m = b as { compatWeb?: { legacyRouteFiles?: number } };
    return s === 200 && (m?.compatWeb?.legacyRouteFiles ?? 0) > 0;
  });
  await probe('GET /api/ping', 'compat', `${BACKEND}/api/ping`, (s, b) => {
    const j = b as { ok?: boolean };
    return s === 200 && j?.ok === true;
  });
  await probe('GET /api/docs/openapi.json', 'docs', `${BACKEND}/api/docs/openapi.json`, (s, b) => {
    const j = b as { openapi?: string };
    return s === 200 && j?.openapi != null;
  });
  await probe(
    'GET /api/mobile/health (legacy)',
    'backend→db',
    `${BACKEND}/api/mobile/health`,
    (s, b) => {
      const j = b as { ok?: boolean };
      return (s === 200 && j?.ok === true) || s === 503;
    },
  );
  await probe(
    'Web proxy /api/health',
    'web→backend',
    `${WEB}/api/health`,
    (s) => s === 200 || s === 503 || s === 502,
  );

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;

  console.log('\n--- Results ---');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.layer}] ${r.name} ${r.status ?? ''} ${r.detail ?? ''}`);
  }
  console.log(`\n${passed}/${total} passed`);

  const critical = ['GET /health', 'GET /api/ping', 'GET /health/modules'];
  const criticalOk = critical.every((n) => results.find((r) => r.name === n)?.ok);

  if (!criticalOk) {
    process.exitCode = 1;
  }
}

main();
