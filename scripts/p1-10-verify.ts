/**
 * P1-10 verification — foundation delegation, refresh DTO, logout Bearer, compat regression.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { issueMobileCredentials, logoutAllForUser } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { isAuthRefreshEnabled } from '../src/modules/auth/refresh-token.config.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const ROOT = join(import.meta.dirname ?? '.', '..');

type Row = { area: string; name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ area, name, ok, detail });
}

function hasFoundationEnvelope(body: unknown): boolean {
  return body != null && typeof (body as { success?: boolean }).success === 'boolean';
}

function hasCompatEnvelope(body: unknown): boolean {
  return body != null && typeof (body as { ok?: boolean }).ok === 'boolean';
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function importsFoundationAuthService(source: string): boolean {
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const base = m[1].split('/').pop();
    if (base === 'auth.service.js') return true;
  }
  return false;
}

function grepProductionAuthNoArchived(): void {
  const authDir = join(ROOT, 'src/modules/auth');
  const skip = new Set(['_archived_foundation', 'legacy-web']);
  const archivedHits: string[] = [];
  const compatAuthServiceHits: string[] = [];

  function walk(dir: string): void {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name.startsWith('.')) continue;
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        if (skip.has(name.name)) continue;
        walk(full);
      } else if (name.name.endsWith('.ts') && !name.name.endsWith('.test.ts')) {
        const text = readFileSync(full, 'utf8');
        if (/from\s+['"][^'"]*_archived_foundation/.test(text)) {
          archivedHits.push(full.replace(ROOT + '\\', '').replace(ROOT + '/', ''));
        }
        if (full.includes('compat') && importsFoundationAuthService(text)) {
          compatAuthServiceHits.push(full);
        }
      }
    }
  }

  walk(authDir);
  push(
    'code',
    'no _archived_foundation in production auth',
    archivedHits.length === 0,
    archivedHits.join('; ') || 'ok',
  );
  push(
    'code',
    'compat does not import AuthService',
    compatAuthServiceHits.length === 0,
    compatAuthServiceHits.length ? compatAuthServiceHits.join('; ') : 'ok',
  );
}

async function probeFoundationHttp(): Promise<void> {
  const otpPhone = `017${String(Date.now()).slice(-8)}`;
  const otpReq = await fetchJson(`${BACKEND}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: otpPhone }),
  });
  const notMigration = JSON.stringify(otpReq.body).indexOf('AUTH_MIGRATION_PENDING') === -1;
  const otpOk =
    notMigration &&
    hasFoundationEnvelope(otpReq.body) &&
    ((otpReq.status === 200 && (otpReq.body as { success: boolean }).success === true) ||
      (otpReq.status === 429 && (otpReq.body as { success: boolean }).success === false));
  push('foundation', 'POST /api/auth/otp/request', otpOk, `status=${otpReq.status}`);

  const badRefresh = await fetchJson(`${BACKEND}/api/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'pd_rt_invalid_p1_10' }),
  });
  const err = (badRefresh.body as { error?: { code?: string } })?.error;
  push(
    'foundation',
    'POST /api/auth/token/refresh invalid → TOKEN_INVALID',
    badRefresh.status === 400 &&
      hasFoundationEnvelope(badRefresh.body) &&
      (badRefresh.body as { success?: boolean }).success === false &&
      err?.code === 'TOKEN_INVALID',
    `status=${badRefresh.status} code=${err?.code}`,
  );

  if (!isAuthRefreshEnabled()) {
    push('foundation', 'refresh rotate returns refreshToken in data', false, 'AUTH_REFRESH_ENABLED=false');
    push('foundation', 'POST /api/auth/logout Bearer', false, 'skipped refresh');
    return;
  }

  const prisma = getPrisma();
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `p1-10-${suffix}@local.test`,
      phone: `018${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'P1-10' } },
    },
    select: { id: true },
  });

  try {
    const creds = await issueMobileCredentials(user.id);
    if (!creds.refreshToken) {
      push('foundation', 'refresh rotate returns refreshToken in data', false, 'no refresh issued');
      return;
    }

    const refreshRes = await fetchJson(`${BACKEND}/api/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: creds.refreshToken }),
    });
    const data = (refreshRes.body as { success?: boolean; data?: { refreshToken?: string } })?.data;
    push(
      'foundation',
      'refresh rotate returns refreshToken in data',
      refreshRes.status === 200 &&
        (refreshRes.body as { success?: boolean }).success === true &&
        typeof data?.refreshToken === 'string' &&
        data.refreshToken.length > 0,
      `status=${refreshRes.status}`,
    );

    const logoutRes = await fetchJson(`${BACKEND}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    push(
      'foundation',
      'POST /api/auth/logout Bearer',
      logoutRes.status === 200 && (logoutRes.body as { success?: boolean }).success === true,
      `status=${logoutRes.status}`,
    );

    const activeSessions = await prisma.userSession.count({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    push(
      'foundation',
      'logout revokes sessions',
      activeSessions === 0,
      `active=${activeSessions}`,
    );
  } finally {
    await logoutAllForUser(user.id).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userSession.deleteMany({ where: { userId: user.id } });
    await prisma.authAuditEvent.deleteMany({ where: { userId: user.id } });
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

async function probeCompatRegression(): Promise<void> {
  const compatPhone = `018${String(Date.now()).slice(-8)}`;
  const compatOtp = await fetchJson(`${BACKEND}/api/mobile/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: compatPhone }),
  });
  const compatOk =
    hasCompatEnvelope(compatOtp.body) &&
    ((compatOtp.status === 200 && (compatOtp.body as { ok: boolean }).ok === true) ||
      (compatOtp.status === 429 && (compatOtp.body as { ok: boolean }).ok === false));
  push(
    'compat',
    'POST /api/mobile/auth/otp/request { ok }',
    compatOk,
    `status=${compatOtp.status}`,
  );
}

async function main(): Promise<void> {
  console.log(`P1-10 verify — ${BACKEND}\n`);

  grepProductionAuthNoArchived();

  try {
    const config = loadConfig();
    createLogger(config);
    createPrismaClient({ config });
    await getPrisma().$queryRaw`SELECT 1`;
    push('database', 'Prisma connectivity', true);
  } catch (e) {
    push('database', 'Prisma connectivity', false, (e as Error).message.slice(0, 100));
  }

  await probeFoundationHttp();
  await probeCompatRegression();

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
  const allPass = passed === total;
  console.log('');
  console.log(`P1_10_PASS=${allPass ? 'YES' : 'NO'}`);
  console.log(`AUTH_DELEGATED=${allPass ? 'YES' : 'NO'}`);

  process.exit(allPass ? 0 : 1);
}

void main();
