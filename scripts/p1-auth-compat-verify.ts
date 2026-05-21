/**
 * P1-00 auth compat — frozen envelope checks (no credential secrets required).
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

async function main(): Promise<void> {
  const pingRes = await fetch(`${BACKEND}/api/ping`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const pingBody = (await pingRes.json().catch(() => null)) as { ok?: boolean } | null;
  results.push({
    name: 'GET /api/ping envelope',
    ok: pingRes.status === 200 && pingBody?.ok === true,
    detail: pingRes.status !== 200 ? `status=${pingRes.status}` : undefined,
  });

  const loginRes = await fetch(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identifier: 'p1-compat@invalid.local', password: 'wrong-password' }),
  });
  const loginBody = (await loginRes.json().catch(() => null)) as {
    ok?: boolean;
    error?: { code?: string; message?: string };
  } | null;
  const loginEnvelopeOk =
    loginBody != null &&
    loginBody.ok === false &&
    typeof loginBody.error?.code === 'string' &&
    typeof loginBody.error?.message === 'string';
  results.push({
    name: 'POST /api/admin/auth/login frozen error envelope',
    ok: loginEnvelopeOk,
    detail: loginEnvelopeOk ? `code=${loginBody?.error?.code}` : JSON.stringify(loginBody)?.slice(0, 120),
  });

  console.log(`Backend: ${BACKEND}\n`);
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} auth compat checks`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
