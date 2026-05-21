/**
 * P1-11 verification — bn/en locales across otp, login, session, permission, device.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { OTP_MSG } from '../src/legacy/web/lib/mobile-auth/otp-messages.js';
import { CRED_MSG } from '../src/legacy/web/lib/mobile-auth/customer-credentials-messages.js';
import { issueMobileCredentials } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { resolveAuthMessage } from '../src/modules/auth/i18n/index.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const DOCTOR_EMAIL = process.env.PRANI_SEED_DOCTOR_EMAIL?.trim() || 'doctor@pranidoctor.local';

type Row = { area: string; name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ area, name, ok, detail });
}

function errMsg(body: unknown): string {
  return (body as { error?: { message?: string } })?.error?.message ?? '';
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

async function main(): Promise<void> {
  console.log(`P1-11 verify — ${BACKEND}\n`);

  push('catalog', 'OTP_MSG bn parity', resolveAuthMessage('OTP_WRONG', 'bn-BD') === OTP_MSG.wrongCode);
  push(
    'catalog',
    'CRED_MSG bn parity',
    resolveAuthMessage('CRED_WRONG_IDENTIFIER_OR_PASSWORD', 'bn-BD') ===
      CRED_MSG.wrongIdentifierOrPassword,
  );
  push(
    'catalog',
    'en resolves',
    resolveAuthMessage('TOKEN_INVALID', 'en-US').toLowerCase().includes('refresh'),
  );

  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });
  const prisma = getPrisma();

  const suffix = Date.now();
  const phone = `015${String(suffix).slice(-8).padStart(8, '0')}`;
  const user = await prisma.user.create({
    data: {
      email: `p1-11-${suffix}@local.test`,
      phone,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'P1-11', locale: 'bn-BD' } },
    },
    select: { id: true },
  });

  try {
    const creds = await issueMobileCredentials(user.id);
    const token = creds.accessToken;

    // --- OTP (frozen BN) ---
    const otpEn = await fetchJson(`${BACKEND}/api/mobile/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-US' },
      body: JSON.stringify({ phone, code: '000000' }),
    });
    const otpEnMsg = errMsg(otpEn.body);
    const otpFrozenBn =
      otpEnMsg === OTP_MSG.wrongCode ||
      otpEnMsg === OTP_MSG.expired ||
      /[\u0980-\u09FF]/.test(otpEnMsg);
    push(
      'otp',
      'frozen BN with Accept-Language en',
      otpEn.status >= 400 &&
        otpFrozenBn &&
        !otpEnMsg.toLowerCase().includes('incorrect otp'),
      otpEnMsg.slice(0, 50) || `status=${otpEn.status}`,
    );

    const otpBn = await fetchJson(`${BACKEND}/api/mobile/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'bn' },
      body: JSON.stringify({ phone, code: '000000' }),
    });
    const otpBnMsg = errMsg(otpBn.body);
    push(
      'otp',
      'BN with Accept-Language bn',
      otpBn.status >= 400 &&
        (otpBnMsg === OTP_MSG.wrongCode || otpBnMsg === OTP_MSG.expired || /[\u0980-\u09FF]/.test(otpBnMsg)),
      otpBnMsg.slice(0, 50),
    );

    // --- Login (frozen BN on compat login path) ---
    const loginEn = await fetchJson(`${BACKEND}/api/mobile/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' },
      body: JSON.stringify({ identifier: phone, password: 'wrong-password-xyz' }),
    });
    const loginEnMsg = errMsg(loginEn.body);
    push(
      'login',
      'frozen BN with Accept-Language en',
      loginEn.status === 401 && loginEnMsg === CRED_MSG.wrongIdentifierOrPassword,
      loginEnMsg.slice(0, 60),
    );

    const loginBn = await fetchJson(`${BACKEND}/api/mobile/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: phone, password: 'wrong-password-xyz' }),
    });
    push(
      'login',
      'bn default wrong credentials',
      errMsg(loginBn.body) === CRED_MSG.wrongIdentifierOrPassword,
      errMsg(loginBn.body).slice(0, 60),
    );

    // --- Session ---
    const sessionEn = await fetchJson(`${BACKEND}/api/mobile/me`, {
      headers: { 'Accept-Language': 'en-US' },
    });
    const sessionEnMsg = errMsg(sessionEn.body);
    push(
      'session',
      'en unauthorized (no bearer)',
      sessionEn.status === 401 && sessionEnMsg.toLowerCase().includes('bearer'),
      sessionEnMsg.slice(0, 60),
    );

    const refreshBn = await fetchJson(`${BACKEND}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'bn-BD' },
      body: JSON.stringify({ refreshToken: 'invalid-token-xyz' }),
    });
    const refreshBnMsg = errMsg(refreshBn.body);
    push(
      'session',
      'bn refresh TOKEN_INVALID',
      refreshBn.status === 401 && refreshBnMsg.includes('রিফ্রেশ'),
      refreshBnMsg.slice(0, 60),
    );

    const refreshEn = await fetchJson(`${BACKEND}/api/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' },
      body: JSON.stringify({ refreshToken: 'invalid-token-xyz' }),
    });
    push(
      'session',
      'en refresh TOKEN_INVALID',
      refreshEn.status === 401 && errMsg(refreshEn.body).toLowerCase().includes('refresh'),
      errMsg(refreshEn.body).slice(0, 60),
    );

    // --- Permission (panel) ---
    const panelEn = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en-US' },
      body: JSON.stringify({ email: DOCTOR_EMAIL, password: 'wrong-panel-password' }),
    });
    const panelEnMsg = errMsg(panelEn.body);
    push(
      'permission',
      'en panel INVALID_CREDENTIALS',
      panelEn.status === 401 && panelEnMsg.toLowerCase().includes('incorrect'),
      panelEnMsg.slice(0, 60),
    );

    const panelBn = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'bn' },
      body: JSON.stringify({ email: DOCTOR_EMAIL, password: 'wrong-panel-password' }),
    });
    const panelBnMsg = errMsg(panelBn.body);
    push(
      'permission',
      'bn panel INVALID_CREDENTIALS',
      panelBn.status === 401 && panelBnMsg.includes('সঠিক নয়'),
      panelBnMsg.slice(0, 60),
    );

    // --- Device ---
    const deviceBn = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'bn',
      },
      body: JSON.stringify({ deviceKey: `p11-bn-${suffix}`, platform: 'symbian' }),
    });
    const bnMsg = errMsg(deviceBn.body);
    push(
      'device',
      'bn platform validation',
      deviceBn.status === 422 && bnMsg.includes('platform'),
      bnMsg.slice(0, 60),
    );
    push(
      'device',
      'Content-Language bn',
      deviceBn.headers.get('content-language') === 'bn-BD',
      deviceBn.headers.get('content-language') ?? 'none',
    );

    const deviceEn = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US',
      },
      body: JSON.stringify({ deviceKey: `p11-en-${suffix}`, platform: 'symbian' }),
    });
    const enMsg = errMsg(deviceEn.body);
    push(
      'device',
      'en platform validation',
      deviceEn.status === 422 && enMsg.toLowerCase().includes('platform'),
      enMsg.slice(0, 60),
    );
    push(
      'device',
      'Content-Language en',
      deviceEn.headers.get('content-language') === 'en-US',
      deviceEn.headers.get('content-language') ?? 'none',
    );

    const meGet = await fetchJson(`${BACKEND}/api/mobile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meLocale = (meGet.body as { ok?: boolean; data?: { locale?: string } })?.data?.locale;
    push('device', 'GET me locale', meGet.status === 200 && meLocale === 'bn-BD', `locale=${meLocale}`);

    const mePatch = await fetchJson(`${BACKEND}/api/mobile/me`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'en-US' }),
    });
    const patched = (mePatch.body as { ok?: boolean; data?: { locale?: string } })?.data?.locale;
    push('device', 'PATCH me locale en-US', mePatch.status === 200 && patched === 'en-US', `locale=${patched}`);

    const deviceProfileEn = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform: 'symbian' }),
    });
    push(
      'device',
      'profile locale fallback en',
      deviceProfileEn.status === 422 && errMsg(deviceProfileEn.body).toLowerCase().includes('device'),
      errMsg(deviceProfileEn.body).slice(0, 60),
    );
  } finally {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userDevice.deleteMany({ where: { userId: user.id } });
    await prisma.userSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

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
  console.log(`P1_11_VERIFY=${allPass ? 'PASS' : 'FAIL'}`);
  console.log(`LOCALE_READY=${allPass ? 'YES' : 'NO'}`);
  console.log('NEXT_STEP=P1-12 (E2E auth certificate)');
  process.exit(allPass ? 0 : 1);
}

void main();
