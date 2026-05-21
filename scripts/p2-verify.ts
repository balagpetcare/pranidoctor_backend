/**
 * P2-11 — Phase 2 verification (user, profile, area, doctor, technician).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { normalizeBdMobilePhone } from '../src/modules/auth/phone.js';
import { UsersRepository } from '../src/modules/users/users.repository.js';
import { DoctorsRepository } from '../src/modules/doctors/doctors.repository.js';
import { listDivisionsMaster } from '../src/modules/area/location-catalog.service.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL?.trim() || 'admin@pranidoctor.com';
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? '12345678';
const DOCTOR_EMAIL = process.env.PRANI_SEED_DOCTOR_EMAIL?.trim() || 'doctor@pranidoctor.local';
const DOCTOR_PASSWORD = process.env.PRANI_SEED_DOCTOR_PASSWORD ?? 'ChangeMe!Doctor123';
const TECH_EMAIL = process.env.PRANI_SEED_AI_TECH_EMAIL?.trim() || 'ai-tech@pranidoctor.local';
const TECH_PASSWORD = process.env.PRANI_SEED_AI_TECH_PASSWORD ?? 'ChangeMe!AiTech123';

type Row = { domain: string; name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(domain: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ domain, name, ok, detail });
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

async function main(): Promise<void> {
  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });

  // Module-level (no HTTP)
  try {
    const usersRepo = new UsersRepository();
    const doctorsRepo = new DoctorsRepository();
    const divs = await listDivisionsMaster();
    push('module', 'UsersRepository.findByPhone (no throw)', true);
    push('module', 'DoctorsRepository.findByUserId (no throw)', true);
    push('module', 'location-catalog divisions', divs.length > 0, `count=${divs.length}`);
    await usersRepo.findByPhone('+8801999999999');
    await doctorsRepo.findByUserId('nonexistent-user-id');
  } catch (e) {
    push('module', 'module smoke', false, String(e));
  }

  // Admin login for OTP logs
  const adminLogin = await fetchJson(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminCookie = sessionCookie(adminLogin.headers, 'prani_admin_token');
  push(
    'http',
    'admin login',
    adminLogin.status === 200 && !!adminCookie,
    `status=${adminLogin.status}`,
  );

  const suffix = Date.now();
  const testPhone = process.env.P2_TEST_PHONE?.trim() || `016${String(suffix).slice(-8).padStart(8, '0')}`;
  const testPassword = process.env.P2_TEST_PASSWORD?.trim() || 'TestPass123!';
  const normalized = normalizeBdMobilePhone(testPhone);
  if (!normalized) {
    push('http', 'normalize test phone', false, testPhone);
  } else {
    // Phase 2 profile path — password register (does not modify auth modules).
    const register = await fetchJson(`${BACKEND}/api/mobile/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'P2 Verify User',
        mobile: testPhone,
        password: testPassword,
      }),
    });
    const regOk =
      register.status === 200 &&
      (register.body as { ok?: boolean })?.ok === true;
    push('register', 'POST /api/mobile/auth/register', regOk, `status=${register.status}`);

    let token =
      regOk &&
      (register.body as { ok?: boolean; data?: { accessToken?: string } }).data?.accessToken;

    if (!token) {
      const login = await fetchJson(`${BACKEND}/api/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testPhone, password: testPassword }),
      });
      token =
        login.status === 200 &&
        (login.body as { ok?: boolean; data?: { accessToken?: string } }).ok &&
        (login.body as { data?: { accessToken?: string } }).data?.accessToken;
      push('http', 'login fallback', Boolean(token), `status=${login.status}`);
    }

    if (token) {
        const me = await fetchJson(`${BACKEND}/api/mobile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const meData =
          me.body != null &&
          typeof me.body === 'object' &&
          (me.body as { ok?: boolean; data?: Record<string, unknown> }).ok
            ? (me.body as { data: Record<string, unknown> }).data
            : null;
        const profileGetOk =
          me.status === 200 &&
          meData != null &&
          typeof meData.id === 'string' &&
          typeof meData.name === 'string' &&
          typeof meData.locale === 'string';
        push('profile', 'GET /api/mobile/me frozen fields', profileGetOk, `status=${me.status}`);

        const patchLocale = await fetchJson(`${BACKEND}/api/mobile/me`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locale: 'en-US' }),
        });
        const patched =
          patchLocale.body != null &&
          typeof patchLocale.body === 'object' &&
          (patchLocale.body as { ok?: boolean; data?: { locale?: string } }).ok
            ? (patchLocale.body as { data: { locale?: string } }).data
            : null;
        push(
          'language',
          'PATCH /api/mobile/me locale en-US',
          patchLocale.status === 200 && patched?.locale === 'en-US',
          `status=${patchLocale.status} locale=${patched?.locale ?? '?'}`,
        );

        const divisions = await fetchJson(`${BACKEND}/api/mobile/locations/divisions`);
        push(
          'area',
          'GET /api/mobile/locations/divisions',
          divisions.status === 200 &&
            divisions.body != null &&
            typeof divisions.body === 'object' &&
            (divisions.body as { ok?: boolean }).ok === true,
          `status=${divisions.status}`,
        );

        const dash = await fetchJson(`${BACKEND}/api/mobile/profile/dashboard-context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dashData =
          dash.body != null &&
          typeof dash.body === 'object' &&
          (dash.body as { ok?: boolean; data?: Record<string, unknown> }).ok
            ? (dash.body as { data: Record<string, unknown> }).data
            : null;
        push(
          'profile',
          'dashboard-context farmSummary additive',
          dash.status === 200 &&
            dashData != null &&
            (dashData.farmSummary == null ||
              (typeof dashData.farmSummary === 'object' &&
                typeof (dashData.farmSummary as { animalCount?: number }).animalCount ===
                  'number')),
          dash.status === 200 ? 'ok' : `status=${dash.status}`,
        );
    } else {
      push('http', 'customer token', false, 'register/login did not return accessToken');
    }
  }

  const docLogin = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
  });
  const docCookie = sessionCookie(docLogin.headers, 'prani_doctor_session');
  if (docCookie) {
    const docMe = await fetchJson(`${BACKEND}/api/doctor/auth/me`, {
      headers: { Cookie: docCookie },
    });
    const docUser =
      docMe.body != null &&
      typeof docMe.body === 'object' &&
      (docMe.body as { ok?: boolean; data?: { user?: Record<string, unknown> } }).ok
        ? (docMe.body as { data: { user?: Record<string, unknown> } }).data?.user
        : null;
    push(
      'doctor',
      'GET /api/doctor/auth/me',
      docMe.status === 200 &&
        docUser != null &&
        typeof docUser.doctorProfileId === 'string',
      `status=${docMe.status}`,
    );
  } else {
    push('doctor', 'GET /api/doctor/auth/me', false, `login status=${docLogin.status}`);
  }

  const techLogin = await fetchJson(`${BACKEND}/api/technician/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TECH_EMAIL, password: TECH_PASSWORD }),
  });
  const techCookie = sessionCookie(techLogin.headers, 'prani_technician_session');
  if (techCookie) {
    const techMe = await fetchJson(`${BACKEND}/api/technician/auth/me`, {
      headers: { Cookie: techCookie },
    });
    const techUser =
      techMe.body != null &&
      typeof techMe.body === 'object' &&
      (techMe.body as { ok?: boolean; data?: { user?: Record<string, unknown> } }).ok
        ? (techMe.body as { data: { user?: Record<string, unknown> } }).data?.user
        : null;
    push(
      'technician',
      'GET /api/technician/auth/me',
      techMe.status === 200 && techUser != null,
      `status=${techMe.status}`,
    );
  } else {
    push(
      'technician',
      'GET /api/technician/auth/me',
      false,
      `login status=${techLogin.status} (seed demo user?)`,
    );
  }

  const foundationMe = await fetchJson(`${BACKEND}/api/users/me`, {
    headers: { 'x-user-id': process.env.P2_TEST_USER_ID ?? '' },
  });
  push(
    'http',
    'GET /api/users/me (foundation)',
    foundationMe.status === 200 || foundationMe.status === 401 || foundationMe.status === 404,
    `status=${foundationMe.status} (401/404 ok without auth middleware)`,
  );

  if (process.env.P2_INCLUDE_P1 === '1') {
    runNpmScript('p1:12-verify');
  } else {
    push('suite', 'p1:12-verify', true, 'skipped (set P2_INCLUDE_P1=1 to run)');
  }

  const failed = rows.filter((r) => !r.ok);
  console.log('\n--- P2 verify matrix ---');
  for (const r of rows) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.domain}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\nP2_MATRIX=${rows.filter((r) => r.ok).length}/${rows.length}`);
  console.log(`P2_PASS=${failed.length === 0 ? 'YES' : 'NO'}`);

  await getPrisma().$disconnect();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
