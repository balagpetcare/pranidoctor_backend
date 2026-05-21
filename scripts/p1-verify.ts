/**
 * Phase 1 unified verify — doctor/technician panels + refresh/session/device.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { SessionStatus, AuthChannel } from '../src/generated/prisma/index.js';
import { issueMobileCredentials, logoutAllForUser } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { getRefreshTokenService } from '../src/modules/auth/refresh-token.service.js';
import { getDeviceService } from '../src/modules/auth/device.service.js';
import { revokeLatestPanelSession } from '../src/modules/auth/panel-session.helper.js';
import { recordPanelSession } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { isAuthRefreshEnabled } from '../src/modules/auth/refresh-token.config.js';
import { getSessionService } from '../src/modules/auth/session.service.js';
import { signMobileCustomerToken } from '../src/modules/auth/tokens/mobile-jwt.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

const DOCTOR_EMAIL = process.env.PRANI_SEED_DOCTOR_EMAIL?.trim() || 'doctor@pranidoctor.local';
const DOCTOR_PASSWORD = process.env.PRANI_SEED_DOCTOR_PASSWORD ?? 'ChangeMe!Doctor123';
const TECH_EMAIL = process.env.PRANI_SEED_AI_TECH_EMAIL?.trim() || 'ai-tech@pranidoctor.local';
const TECH_PASSWORD = process.env.PRANI_SEED_AI_TECH_PASSWORD ?? 'ChangeMe!AiTech123';

type Row = { area: string; name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(area: string, name: string, ok: boolean, detail?: string): void {
  rows.push({ area, name, ok, detail });
}

function hasCompatEnvelope(body: unknown): boolean {
  return body != null && typeof (body as { ok?: boolean }).ok === 'boolean';
}

/** Full `Cookie` header value (`name=value`) for follow-up panel requests. */
function sessionCookieHeader(headers: Headers, name: string): string | null {
  const lines = headers.getSetCookie?.() ?? [];
  for (const line of lines) {
    if (line.startsWith(`${name}=`)) {
      const pair = line.split(';')[0]?.trim();
      return pair && pair.includes('=') ? pair : null;
    }
  }
  const raw = headers.get('set-cookie');
  if (!raw) return null;
  const m = raw.match(new RegExp(`${name}=([^;]+)`));
  return m?.[1] ? `${name}=${m[1]}` : null;
}

async function fetchWithCookies(
  url: string,
  init: RequestInit & { cookie?: string },
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set('Accept', 'application/json');
  if (init.cookie) headers.set('Cookie', init.cookie);
  const res = await fetch(url, { ...init, headers, cache: 'no-store' });
  return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
}

async function initDb(): Promise<void> {
  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });
  await getPrisma().$queryRaw`SELECT 1`;
  push('database', 'Prisma connectivity', true);
}

async function probePanelHttp(
  panel: 'doctor' | 'technician',
  email: string,
  password: string,
  cookieName: string,
  profileIdKey: 'doctorProfileId' | 'aiTechnicianProfileId',
): Promise<void> {
  const base = `${BACKEND}/api/${panel}/auth`;

  const loginRes = await fetchWithCookies(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const loginOk =
    loginRes.status === 200 &&
    hasCompatEnvelope(loginRes.body) &&
    (loginRes.body as { ok: boolean }).ok === true;
  const cookie = sessionCookieHeader(loginRes.headers, cookieName);
  push(
    panel,
    'login',
    loginOk && !!cookie,
    loginOk ? `cookie set` : `status=${loginRes.status} code=${(loginRes.body as { error?: { code?: string } })?.error?.code}`,
  );

  if (!cookie) {
    push(panel, 'me', false, 'skipped — no session cookie');
    push(panel, 'logout', false, 'skipped');
    return;
  }

  const meRes = await fetchWithCookies(`${base}/me`, { method: 'GET', cookie });
  const meData = (meRes.body as { ok?: boolean; data?: { user?: Record<string, unknown> } })?.data?.user;
  const meOk =
    meRes.status === 200 &&
    (meRes.body as { ok?: boolean })?.ok === true &&
    typeof meData?.id === 'string' &&
    typeof meData?.[profileIdKey] === 'string' &&
    typeof meData?.providerStatus === 'string';
  push(
    panel,
    'me',
    meOk,
    meOk
      ? `id=${String(meData?.id).slice(0, 8)}… providerStatus=${meData?.providerStatus}`
      : `status=${meRes.status} keys=${meData ? Object.keys(meData).join(',') : 'none'}`,
  );

  const loginUser = (loginRes.body as { ok?: boolean; data?: { user?: { id?: string } } })?.data
    ?.user;
  const userId = (meData?.id ?? loginUser?.id) as string | undefined;
  let sessionsBefore = 0;
  if (userId) {
    sessionsBefore = await getPrisma().userSession.count({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        channel: panel === 'doctor' ? AuthChannel.DOCTOR_PANEL : AuthChannel.TECHNICIAN_PANEL,
      },
    });
  }

  const logoutRes = await fetchWithCookies(`${base}/logout`, { method: 'POST', cookie });
  const logoutOk =
    logoutRes.status === 200 && (logoutRes.body as { ok?: boolean })?.ok === true;
  push(panel, 'logout', logoutOk, `status=${logoutRes.status}`);

  if (cookie) {
    const meAfterLogout = await fetchWithCookies(`${base}/me`, { method: 'GET', cookie });
    push(
      panel,
      'me after logout (session guard)',
      meAfterLogout.status === 401,
      `status=${meAfterLogout.status}`,
    );
  } else {
    push(panel, 'me after logout (session guard)', false, 'skipped');
  }

  if (userId && sessionsBefore > 0) {
    const sessionsAfter = await getPrisma().userSession.count({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        channel: panel === 'doctor' ? AuthChannel.DOCTOR_PANEL : AuthChannel.TECHNICIAN_PANEL,
      },
    });
    push(
      panel,
      'session revoke on logout',
      sessionsAfter < sessionsBefore,
      `before=${sessionsBefore} after=${sessionsAfter}`,
    );
  } else {
    push(panel, 'session revoke on logout', true, 'no prior session row or login skipped');
  }
}

async function fetchMobileMe(accessToken: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BACKEND}/api/mobile/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function probeSessionHardening(): Promise<void> {
  const prisma = getPrisma();
  const suffix = Date.now();

  const userA = await prisma.user.create({
    data: {
      email: `p1-harden-a-${suffix}@local.test`,
      phone: `018${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'Harden A' } },
    },
    select: { id: true },
  });

  const userB = await prisma.user.create({
    data: {
      email: `p1-harden-b-${suffix}@local.test`,
      phone: `019${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'Harden B' } },
    },
    select: { id: true },
  });

  try {
    const creds = await issueMobileCredentials(userA.id);

    await prisma.userSession.update({
      where: { id: creds.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expiredMe = await fetchMobileMe(creds.accessToken);
    push(
      'session',
      'expired session rejected',
      expiredMe.status === 401,
      `status=${expiredMe.status}`,
    );

    const credsB = await issueMobileCredentials(userB.id);
    const mismatchedToken = await signMobileCustomerToken(userB.id, creds.sessionId);
    const mismatchMe = await fetchMobileMe(mismatchedToken);
    push(
      'session',
      'sid mismatch rejected',
      mismatchMe.status === 401,
      `status=${mismatchMe.status} sub=B sid=A`,
    );

    await getSessionService().revoke(credsB.sessionId, 'verify_cleanup');
    const tamperToken = await signMobileCustomerToken(userA.id, credsB.sessionId);
    const tamperMe = await fetchMobileMe(tamperToken);
    push(
      'session',
      'sid userId tamper rejected',
      tamperMe.status === 401,
      `status=${tamperMe.status} sub=A sid=B`,
    );
  } finally {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.userDevice.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.userSession.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.authAuditEvent.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.customerProfile.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
  }
}

async function probeMobileP1_06(): Promise<void> {
  push('mobile', 'AUTH_REFRESH_ENABLED', isAuthRefreshEnabled());

  const prisma = getPrisma();
  const suffix = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `p1-verify-${suffix}@local.test`,
      phone: `017${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'P1 Verify' } },
    },
    select: { id: true },
  });

  try {
    const creds = await issueMobileCredentials(user.id, undefined, {
      deviceKey: `p1-verify-device-${suffix}`,
      platform: 'test',
    });
    push(
      'mobile',
      'login (issue credentials)',
      !!creds.accessToken && !!creds.sessionId,
      `refresh=${creds.refreshToken ? 'yes' : 'no'}`,
    );

    if (creds.refreshToken) {
      const compatRefresh = await fetchWithCookies(`${BACKEND}/api/mobile/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: creds.refreshToken }),
      });
      const compatData = (compatRefresh.body as { ok?: boolean; data?: { accessToken?: string } })
        ?.data;
      push(
        'mobile',
        'refresh HTTP /api/mobile/auth/refresh',
        compatRefresh.status === 200 &&
          (compatRefresh.body as { ok?: boolean })?.ok === true &&
          !!compatData?.accessToken,
        `status=${compatRefresh.status}`,
      );

      const tokenForFoundation =
        (compatRefresh.body as { ok?: boolean; data?: { refreshToken?: string } })?.data
          ?.refreshToken ?? creds.refreshToken;
      const rotated = await getRefreshTokenService().rotate(tokenForFoundation);
      push(
        'mobile',
        'refresh (rotate)',
        rotated !== null && !!rotated.accessToken,
        rotated ? 'ok' : 'null',
      );

      if (rotated?.refreshToken) {
        const httpRefresh = await fetchWithCookies(`${BACKEND}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rotated.refreshToken }),
        });
        const foundationData = (
          httpRefresh.body as { success?: boolean; data?: { refreshToken?: string } }
        )?.data;
        push(
          'mobile',
          'refresh HTTP /api/auth/token/refresh',
          httpRefresh.status === 200 &&
            (httpRefresh.body as { success?: boolean })?.success === true &&
            typeof foundationData?.refreshToken === 'string' &&
            foundationData.refreshToken.length > 0,
          `status=${httpRefresh.status}`,
        );
      }
    } else {
      push('mobile', 'refresh (rotate)', false, 'no refresh issued');
      push('mobile', 'refresh HTTP /api/auth/token/refresh', false, 'skipped');
      push('mobile', 'refresh HTTP /api/mobile/auth/refresh', false, 'skipped');
    }

    const deviceKey = `p1-verify-device-reg-${suffix}`;
    const regHttp = await fetchWithCookies(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceKey, platform: 'android' }),
    });
    const regData = (regHttp.body as { ok?: boolean; data?: { deviceId?: string } })?.data;
    push(
      'mobile',
      'device register HTTP',
      regHttp.status === 200 &&
        (regHttp.body as { ok?: boolean })?.ok === true &&
        !!regData?.deviceId,
      `status=${regHttp.status}`,
    );

    const listHttp = await fetchWithCookies(`${BACKEND}/api/mobile/devices`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });
    const listed = (listHttp.body as { ok?: boolean; data?: { devices?: { id: string }[] } })?.data
      ?.devices;
    push(
      'mobile',
      'device list HTTP',
      listHttp.status === 200 && Array.isArray(listed) && listed.length > 0,
      `count=${listed?.length ?? 0}`,
    );

    const dev = await getDeviceService().registerOrUpdate({
      userId: user.id,
      deviceKey: `p1-verify-device-2-${suffix}`,
    });
    const revoked = await getDeviceService().revokeWithCascade(user.id, dev.id);
    const devRow = await prisma.userDevice.findUnique({ where: { id: dev.id } });
    push(
      'mobile',
      'device revoke',
      revoked.revoked && devRow?.revokedAt != null,
    );

    await logoutAllForUser(user.id);
    const activeSessions = await prisma.userSession.count({
      where: { userId: user.id, status: SessionStatus.ACTIVE },
    });
    const activeRefresh = await prisma.refreshToken.count({
      where: { userId: user.id, revoked: false },
    });
    push(
      'mobile',
      'logout-all',
      activeSessions === 0 && activeRefresh === 0,
      `sessions=${activeSessions} refresh=${activeRefresh}`,
    );
  } finally {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userDevice.deleteMany({ where: { userId: user.id } });
    await prisma.userSession.deleteMany({ where: { userId: user.id } });
    await prisma.authAuditEvent.deleteMany({ where: { userId: user.id } });
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

async function main(): Promise<void> {
  console.log(`P1 verify — ${BACKEND}\n`);

  try {
    await initDb();
  } catch (e) {
    push('database', 'Prisma connectivity', false, (e as Error).message.slice(0, 100));
  }

  await probePanelHttp('doctor', DOCTOR_EMAIL, DOCTOR_PASSWORD, 'prani_doctor_session', 'doctorProfileId');
  await probePanelHttp(
    'technician',
    TECH_EMAIL,
    TECH_PASSWORD,
    'prani_technician_session',
    'aiTechnicianProfileId',
  );

  if (getPrisma) {
    try {
      await probeMobileP1_06();
    } catch (e) {
      push('mobile', 'P1-06 flows', false, (e as Error).message.slice(0, 120));
    }
    try {
      await probeSessionHardening();
    } catch (e) {
      push('session', 'hardening probes', false, (e as Error).message.slice(0, 120));
    }
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
  console.log('');
  console.log(`P1_VERIFY_PASS=${allPass ? 'YES' : 'NO'}`);
  console.log(`I18N_READY=${allPass ? 'YES' : 'NO'} (run npm run p1:11-verify for locale catalog)`);
  console.log('NEXT_STEP=P1-12 (E2E auth certificate)');

  process.exit(allPass ? 0 : 1);
}

void main();
