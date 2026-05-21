/**
 * P1-12 — Phase 1 final auth verification (contract matrix + domain rollup).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { getOtpDevLogSnapshotForAdmin } from '../src/legacy/web/lib/mobile-auth/otp-dev-log.js';
import { normalizeBdMobilePhone } from '../src/modules/auth/phone.js';
import { isAuthRefreshEnabled } from '../src/modules/auth/refresh-token.config.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL?.trim() || 'admin@pranidoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? '12345678';
const DOCTOR_EMAIL = process.env.PRANI_SEED_DOCTOR_EMAIL?.trim() || 'doctor@pranidoctor.local';
const DOCTOR_PASSWORD = process.env.PRANI_SEED_DOCTOR_PASSWORD ?? 'ChangeMe!Doctor123';

type Row = { domain: string; name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(domain: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ domain, name, ok, detail });
}

function hasCompat(body: unknown): boolean {
  return body != null && typeof (body as { ok?: boolean }).ok === 'boolean';
}

function hasFoundation(body: unknown): boolean {
  return body != null && typeof (body as { success?: boolean }).success === 'boolean';
}

function sessionCookie(headers: Headers, name: string): string | null {
  const lines = headers.getSetCookie?.() ?? [];
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      return line.split(';')[0]?.trim() ?? null;
    }
  }
  const raw = headers.get('set-cookie');
  if (!raw) return null;
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  return m?.[1] ? `${name}=${m[1]}` : null;
}

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function runNpmScript(script: string): boolean {
  const r = spawnSync('npm', ['run', script], {
    cwd: BACKEND_ROOT,
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const ok = r.status === 0;
  push('suite', script, ok, ok ? 'exit 0' : `exit ${r.status ?? '?'}`);
  return ok;
}

async function probeContractMatrix(): Promise<void> {
  // 1 Admin login valid
  const adminLogin = await fetchJson(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminCookie = sessionCookie(adminLogin.headers, 'prani_admin_token');
  push(
    'login',
    'matrix #1 admin login valid',
    adminLogin.status === 200 &&
      hasCompat(adminLogin.body) &&
      (adminLogin.body as { ok: boolean }).ok === true &&
      !!adminCookie,
    `status=${adminLogin.status}`,
  );

  // 2 Admin bad password
  const adminBad = await fetchJson(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: ADMIN_EMAIL, password: 'wrong-password-p12' }),
  });
  const badCode = (adminBad.body as { error?: { code?: string } })?.error?.code;
  push(
    'login',
    'matrix #2 admin invalid_credentials',
    hasCompat(adminBad.body) &&
      (adminBad.body as { ok: boolean }).ok === false &&
      badCode === 'invalid_credentials',
    `code=${badCode}`,
  );

  // 3 Admin me
  if (adminCookie) {
    const adminMe = await fetchJson(`${BACKEND}/api/admin/auth/me`, {
      headers: { Cookie: adminCookie },
    });
    push(
      'login',
      'matrix #3 admin me',
      adminMe.status === 200 && (adminMe.body as { ok?: boolean })?.ok === true,
      `status=${adminMe.status}`,
    );
  } else {
    push('login', 'matrix #3 admin me', false, 'no cookie');
  }

  // 4–5 Mobile OTP
  const suffix = Date.now();
  const phone = `016${String(suffix).slice(-8).padStart(8, '0')}`;
  const otpReq = await fetchJson(`${BACKEND}/api/mobile/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const sent = (otpReq.body as { ok?: boolean; data?: { sent?: boolean } })?.data?.sent;
  push(
    'otp',
    'matrix #4 mobile otp request',
    otpReq.status === 200 && (otpReq.body as { ok?: boolean })?.ok === true && sent === true,
    `status=${otpReq.status}`,
  );

  const normalized = normalizeBdMobilePhone(phone);
  let code = '';
  if (adminCookie && normalized) {
    const logsRes = await fetchJson(`${BACKEND}/api/admin/dev-tools/otp-logs`, {
      headers: { Cookie: adminCookie },
    });
    const entries = (
      logsRes.body as {
        ok?: boolean;
        data?: { entries?: { phoneNormalized: string; otpPlain: string | null }[] };
      }
    )?.data?.entries;
    code = entries?.find((e) => e.phoneNormalized === normalized)?.otpPlain ?? '';
  }
  if (!code) {
    const devRow = getOtpDevLogSnapshotForAdmin().find((e) => e.phoneNormalized === normalized);
    code = devRow?.otpPlain ?? '';
  }
  let accessToken = '';
  let refreshTokenFromOtp = '';
  if (code) {
    const otpVerify = await fetchJson(`${BACKEND}/api/mobile/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const verifyData = (otpVerify.body as { ok?: boolean; data?: { accessToken?: string; refreshToken?: string } })
      ?.data;
    accessToken = verifyData?.accessToken ?? '';
    refreshTokenFromOtp = verifyData?.refreshToken ?? '';
    push(
      'otp',
      'matrix #5 mobile otp verify',
      otpVerify.status === 200 &&
        (otpVerify.body as { ok?: boolean })?.ok === true &&
        accessToken.length > 10,
      code ? 'dev otp' : 'no code',
    );
  } else {
    push('otp', 'matrix #5 mobile otp verify', false, 'dev OTP not in log');
  }

  // 6 Mobile me
  if (accessToken) {
    const me = await fetchJson(`${BACKEND}/api/mobile/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    push(
      'login',
      'matrix #6 mobile me Bearer',
      me.status === 200 && (me.body as { ok?: boolean })?.ok === true,
      `status=${me.status}`,
    );
  } else {
    push('login', 'matrix #6 mobile me Bearer', false, 'skipped');
  }

  // 7 Mobile refresh
  if (isAuthRefreshEnabled() && refreshTokenFromOtp) {
    const refresh = await fetchJson(`${BACKEND}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenFromOtp }),
    });
    const refData = (refresh.body as { ok?: boolean; data?: { accessToken?: string } })?.data;
    push(
      'refresh',
      'matrix #7 mobile refresh',
      refresh.status === 200 &&
        (refresh.body as { ok?: boolean })?.ok === true &&
        !!refData?.accessToken,
      `status=${refresh.status}`,
    );
  } else {
    push(
      'refresh',
      'matrix #7 mobile refresh',
      false,
      isAuthRefreshEnabled() ? 'no refresh from otp verify' : 'refresh disabled',
    );
  }

  // 8 Doctor login
  const docLogin = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
  });
  push(
    'login',
    'matrix #8 doctor login',
    docLogin.status === 200 &&
      (docLogin.body as { ok?: boolean })?.ok === true &&
      !!sessionCookie(docLogin.headers, 'prani_doctor_session'),
    `status=${docLogin.status}`,
  );

  // 9 Foundation otp/request
  const fPhone = `019${String(suffix + 1).slice(-8).padStart(8, '0')}`;
  const fOtp = await fetchJson(`${BACKEND}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: fPhone }),
  });
  push(
    'otp',
    'matrix #9 foundation otp/request',
    hasFoundation(fOtp.body) &&
      (fOtp.status === 200
        ? (fOtp.body as { success: boolean }).success === true
        : fOtp.status === 429),
    `status=${fOtp.status}`,
  );

  // 10 Permission deny — cross-panel (doctor cookie on admin route) or unauthenticated admin route
  const docCookie = sessionCookie(docLogin.headers, 'prani_doctor_session');
  const crossPanel = docCookie
    ? await fetchJson(`${BACKEND}/api/admin/dev-tools/otp-logs`, {
        headers: { Cookie: docCookie },
      })
    : { status: 0, body: null, headers: new Headers() };
  const crossCode = (crossPanel.body as { error?: { code?: string } })?.error?.code;
  const unauthAdmin = await fetchJson(`${BACKEND}/api/admin/dev-tools/otp-logs`, { method: 'GET' });
  const unauthCode = (unauthAdmin.body as { error?: { code?: string } })?.error?.code;
  const matrix10Ok =
    (crossPanel.status === 403 && crossCode === 'FORBIDDEN') ||
    (crossPanel.status === 401 && crossCode === 'UNAUTHORIZED') ||
    (unauthAdmin.status === 401 && unauthCode === 'UNAUTHORIZED');
  push(
    'permission',
    'matrix #10 permission deny',
    matrix10Ok &&
      (crossPanel.body == null || hasCompat(crossPanel.body)) &&
      hasCompat(unauthAdmin.body),
    `cross=${crossPanel.status}/${crossCode ?? '-'} unauth=${unauthAdmin.status}/${unauthCode ?? '-'}`,
  );

  // Domain: logout (foundation + panel pattern)
  if (accessToken) {
    const logout = await fetchJson(`${BACKEND}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    push(
      'logout',
      'foundation logout Bearer',
      logout.status === 200 && (logout.body as { success?: boolean })?.success === true,
      `status=${logout.status}`,
    );
  }
  if (adminCookie) {
    const adminLogout = await fetchJson(`${BACKEND}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    push(
      'logout',
      'admin logout',
      adminLogout.status === 200 && (adminLogout.body as { ok?: boolean })?.ok === true,
      `status=${adminLogout.status}`,
    );
  }
}

function domainSummary(domain: string): { pass: number; total: number; ok: boolean } {
  const list = rows.filter((r) => r.domain === domain);
  const pass = list.filter((r) => r.ok).length;
  return { pass, total: list.length, ok: list.length > 0 && pass === list.length };
}

async function main(): Promise<void> {
  console.log(`P1-12 final verify — ${BACKEND}\n`);

  try {
    const config = loadConfig();
    createLogger(config);
    createPrismaClient({ config });
    await getPrisma().$queryRaw`SELECT 1`;
    push('suite', 'database', true);
  } catch (e) {
    push('suite', 'database', false, (e as Error).message.slice(0, 80));
  }

  await probeContractMatrix();

  const matrixRowsEarly = rows.filter((r) => r.name.startsWith('matrix'));
  console.log('\n--- Contract matrix (HTTP) ---\n');
  for (const r of matrixRowsEarly) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`  ${matrixRowsEarly.filter((r) => r.ok).length}/${matrixRowsEarly.length} matrix checks\n`);

  console.log('--- Phase 1 script suite ---\n');
  const scripts = [
    'p1:auth-compat',
    'p1:03-verify',
    'p1:07-08-verify',
    'p1:04-05-verify',
    'p1:06-verify',
    'p1:09-verify',
    'p1:10-verify',
    'p1:11-verify',
  ] as const;

  let suiteOk = true;
  for (const s of scripts) {
    if (!runNpmScript(s)) suiteOk = false;
  }

  const domains = ['otp', 'login', 'logout', 'refresh', 'device', 'permission', 'locale'] as const;
  const domainFromSuite: Record<string, boolean> = {
    otp: true,
    login: true,
    logout: true,
    refresh: true,
    device: true,
    permission: true,
    locale: true,
  };

  for (const d of domains) {
    const matrix = domainSummary(d);
    if (matrix.total > 0 && !matrix.ok) domainFromSuite[d] = false;
  }

  // Suite proxies for device/locale when matrix did not cover
  domainFromSuite.device =
    domainFromSuite.device && rows.some((r) => r.name === 'p1:09-verify' && r.ok);
  domainFromSuite.locale =
    domainFromSuite.locale && rows.some((r) => r.name === 'p1:11-verify' && r.ok);
  domainFromSuite.refresh =
    domainFromSuite.refresh &&
    rows.some((r) => r.name === 'p1:06-verify' && r.ok) &&
    rows.some((r) => r.name === 'p1:10-verify' && r.ok);
  domainFromSuite.permission =
    domainFromSuite.permission && rows.some((r) => r.name === 'p1:11-verify' && r.ok);
  domainFromSuite.login =
    domainFromSuite.login &&
    rows.some((r) => r.name === 'p1:03-verify' && r.ok) &&
    rows.some((r) => r.name === 'p1:04-05-verify' && r.ok);
  domainFromSuite.otp =
    domainFromSuite.otp &&
    rows.some((r) => r.name === 'p1:10-verify' && r.ok);

  console.log('\n--- Domain rollup ---\n');
  for (const d of domains) {
    const m = domainSummary(d);
    const ok = domainFromSuite[d];
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${d}${m.total ? ` (${m.pass}/${m.total} matrix)` : ''}`);
  }

  const matrixRows = rows.filter((r) => r.name.startsWith('matrix'));
  const matrixPass = matrixRows.filter((r) => r.ok).length;
  console.log(`\nContract matrix: ${matrixPass}/${matrixRows.length}`);

  const allPass =
    suiteOk &&
    matrixPass === matrixRows.length &&
    domains.every((d) => domainFromSuite[d]);

  console.log(`\nP1_COMPLETE=${allPass ? 'YES' : 'NO'}`);
  console.log(`AUTH_COMPLETE=${allPass ? 'YES' : 'NO'}`);
  console.log(`PHASE2_READY=${allPass ? 'YES' : 'NO'}`);

  process.exit(allPass ? 0 : 1);
}

void main();
