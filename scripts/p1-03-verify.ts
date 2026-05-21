/**
 * P1-03 verification — panels + foundation auth (envelope, logout, me, tokens, audit).
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

type Row = { area: string; name: string; ok: boolean; detail?: string };

const rows: Row[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ area, name, ok, detail });
}

function hasCompatEnvelope(body: unknown): boolean {
  if (body == null || typeof body !== 'object') return false;
  const b = body as { ok?: boolean };
  return typeof b.ok === 'boolean';
}

function hasFoundationEnvelope(body: unknown): boolean {
  if (body == null || typeof body !== 'object') return false;
  const b = body as { success?: boolean };
  return typeof b.success === 'boolean';
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

function cookieFromHeaders(headers: Headers, name: string): string | null {
  const setCookie = headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) {
    for (const line of setCookie) {
      if (line.startsWith(`${name}=`)) {
        return line.split(';')[0]?.split('=').slice(1).join('=') ?? null;
      }
    }
  }
  const raw = headers.get('set-cookie');
  if (!raw) return null;
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ?? null;
}

async function probePanel(
  panel: 'admin' | 'doctor' | 'technician',
  loginBody: Record<string, string>,
): Promise<void> {
  const base = `${BACKEND}/api/${panel}/auth`;

  const badLogin = await fetchJson(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginBody),
  });
  push(
    panel,
    'login invalid envelope',
    hasCompatEnvelope(badLogin.body) && (badLogin.body as { ok: boolean }).ok === false,
    `status=${badLogin.status} code=${(badLogin.body as { error?: { code?: string } })?.error?.code}`,
  );

  const logout = await fetchJson(`${base}/logout`, { method: 'POST' });
  push(
    panel,
    'logout envelope',
    logout.status === 200 && hasCompatEnvelope(logout.body) && (logout.body as { ok: boolean }).ok === true,
    `status=${logout.status}`,
  );

  const me = await fetchJson(`${base}/me`, { method: 'GET' });
  push(
    panel,
    'me unauthenticated 401',
    me.status === 401 && hasCompatEnvelope(me.body) && (me.body as { ok: boolean }).ok === false,
    `status=${me.status}`,
  );
}

async function probeFoundation(): Promise<void> {
  const otpReq = await fetchJson(`${BACKEND}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '01712345678' }),
  });
  const notMigration =
    JSON.stringify(otpReq.body).indexOf('AUTH_MIGRATION_PENDING') === -1;
  push(
    'foundation',
    '/api/auth/otp/request live',
    notMigration && (otpReq.status === 200 || otpReq.status === 429) && hasFoundationEnvelope(otpReq.body),
    `status=${otpReq.status}`,
  );

  const ping = await fetchJson(`${BACKEND}/api/ping`);
  push('foundation', '/api/ping', ping.status === 200 && (ping.body as { ok?: boolean })?.ok === true);
}

async function probeDbAudit(): Promise<void> {
  try {
    const config = loadConfig();
    createLogger(config);
    createPrismaClient({ config });
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    push('database', 'Prisma connectivity', true);

    const auditCount = await prisma.authAuditEvent.count();
    push('audit', 'AuthAuditEvent table readable', true, `rows=${auditCount}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push('database', 'Prisma connectivity', false, msg.slice(0, 120));
    push('audit', 'AuthAuditEvent table readable', false, 'db unavailable');
  }
}

async function main(): Promise<void> {
  console.log(`P1-03 verify — backend ${BACKEND}\n`);

  await probePanel('admin', { identifier: 'verify-invalid@local.test', password: 'wrong' });
  await probePanel('doctor', { email: 'verify-invalid@local.test', password: 'wrong' });
  await probePanel('technician', { email: 'verify-invalid@local.test', password: 'wrong' });
  await probeFoundation();
  await probeDbAudit();

  const byArea = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byArea.get(r.area) ?? [];
    list.push(r);
    byArea.set(r.area, list);
  }

  for (const [area, list] of byArea) {
    console.log(`[${area}]`);
    for (const r of list) {
      console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log('');
  }

  const passed = rows.filter((r) => r.ok).length;
  const total = rows.length;
  console.log(`${passed}/${total} checks passed`);
  process.exit(passed === total ? 0 : 1);
}

void main();
