/**
 * P1-06 verification — login, refresh, logout, logout-all, device revoke + HTTP smoke.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { SessionStatus } from '../src/generated/prisma/index.js';
import { issueMobileCredentials, logoutAllForUser } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { getRefreshTokenService } from '../src/modules/auth/refresh-token.service.js';
import { getSessionService } from '../src/modules/auth/session.service.js';
import { getDeviceService } from '../src/modules/auth/device.service.js';
import { isAuthRefreshEnabled } from '../src/modules/auth/refresh-token.config.js';

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

async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let ephemeralUserId: string | null = null;

async function resolveTestCustomerId(): Promise<string | null> {
  const prisma = getPrisma();
  const existing = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', status: 'ACTIVE' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const suffix = Date.now();
  const created = await prisma.user.create({
    data: {
      email: `p1-06-verify-${suffix}@local.test`,
      phone: `017${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$P1_06_VERIFY_PLACEHOLDER_NOT_FOR_LOGIN',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: {
        create: { displayName: 'P1-06 Verify' },
      },
    },
    select: { id: true },
  });
  ephemeralUserId = created.id;
  return created.id;
}

async function cleanupEphemeralUser(): Promise<void> {
  if (!ephemeralUserId) return;
  const prisma = getPrisma();
  await prisma.refreshToken.deleteMany({ where: { userId: ephemeralUserId } });
  await prisma.userSession.deleteMany({ where: { userId: ephemeralUserId } });
  await prisma.userDevice.deleteMany({ where: { userId: ephemeralUserId } });
  await prisma.authAuditEvent.deleteMany({ where: { userId: ephemeralUserId } });
  await prisma.customerProfile.deleteMany({ where: { userId: ephemeralUserId } });
  await prisma.user.delete({ where: { id: ephemeralUserId } }).catch(() => {});
}

async function probeIntegrationFlows(): Promise<void> {
  const refreshEnabled = isAuthRefreshEnabled();
  push('config', 'AUTH_REFRESH_ENABLED', refreshEnabled, refreshEnabled ? 'on' : 'off');

  const userId = await resolveTestCustomerId();
  if (!userId) {
    push('login', 'mobile credentials issue', false, 'no ACTIVE CUSTOMER user in DB');
    push('refresh', 'rotate refresh token', false, 'skipped');
    push('logout', 'revoke single session', false, 'skipped');
    push('logout-all', 'revoke all sessions + refresh', false, 'skipped');
    push('device', 'device register + revoke', false, 'skipped');
    return;
  }

  try {
    const login = await issueMobileCredentials(userId, undefined, {
      deviceKey: `p1-06-verify-${Date.now()}`,
      platform: 'test',
    });
    push(
      'login',
      'mobile credentials issue (session + access)',
      !!login.accessToken && !!login.sessionId,
      `sessionId=${login.sessionId.slice(0, 8)}…`,
    );

    if (!refreshEnabled || !login.refreshToken) {
      push('refresh', 'rotate refresh token', false, 'refresh not issued');
    } else {
      const rotated = await getRefreshTokenService().rotate(login.refreshToken);
      push(
        'refresh',
        'rotate refresh token',
        rotated !== null && !!rotated.accessToken && !!rotated.refreshToken,
        rotated ? 'rotated' : 'null',
      );

      if (rotated?.refreshToken) {
        const httpRefresh = await fetchJson(`${BACKEND}/api/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rotated.refreshToken }),
        });
        const httpOk =
          httpRefresh.status === 200 &&
          (httpRefresh.body as { success?: boolean })?.success === true &&
          !!(httpRefresh.body as { data?: { accessToken?: string } })?.data?.accessToken;
        push('refresh', 'HTTP POST /api/auth/token/refresh', httpOk, `status=${httpRefresh.status}`);
      }
    }

    const login2 = await issueMobileCredentials(userId, undefined, {
      deviceKey: `p1-06-logout-${Date.now()}`,
    });
    const revoked = await getSessionService().revoke(login2.sessionId, 'logout');
    const sessionAfter = await getPrisma().userSession.findUnique({
      where: { id: login2.sessionId },
    });
    push(
      'logout',
      'revoke single session',
      revoked && sessionAfter?.status === SessionStatus.REVOKED,
      `status=${sessionAfter?.status}`,
    );

    const login3 = await issueMobileCredentials(userId);
    await logoutAllForUser(userId);
    const activeSessions = await getPrisma().userSession.count({
      where: { userId, status: SessionStatus.ACTIVE },
    });
    const activeRefresh = await getPrisma().refreshToken.count({
      where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    });
    push(
      'logout-all',
      'revoke all sessions + refresh tokens',
      activeSessions === 0 && activeRefresh === 0,
      `activeSessions=${activeSessions} activeRefresh=${activeRefresh}`,
    );

    const dev = await getDeviceService().registerOrUpdate({
      userId,
      deviceKey: `p1-06-device-${Date.now()}`,
      platform: 'android',
    });
    const devRevoked = await getDeviceService().revoke(userId, dev.id);
    const devRow = await getPrisma().userDevice.findUnique({ where: { id: dev.id } });
    push(
      'device',
      'device register + revoke',
      devRevoked && devRow?.revokedAt != null,
      `deviceId=${dev.id.slice(0, 8)}…`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push('integration', 'flow error', false, msg.slice(0, 160));
  }
}

async function probeHttpPanels(): Promise<void> {
  const badLogin = await fetchJson(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'p1-06-verify@invalid.local', password: 'wrong' }),
  });
  const envelope =
    badLogin.body != null && typeof (badLogin.body as { ok?: boolean }).ok === 'boolean';
  push(
    'compat',
    'admin login frozen envelope',
    envelope && (badLogin.body as { ok: boolean }).ok === false,
    `status=${badLogin.status}`,
  );

  const logout = await fetchJson(`${BACKEND}/api/admin/auth/logout`, { method: 'POST' });
  push(
    'compat',
    'admin logout envelope',
    logout.status === 200 && (logout.body as { ok?: boolean })?.ok === true,
    `status=${logout.status}`,
  );
}

async function probeDb(): Promise<void> {
  try {
    const config = loadConfig();
    createLogger(config);
    createPrismaClient({ config });
    const prisma = getPrisma();

    await prisma.$queryRaw`SELECT 1`;
    push('database', 'Prisma connectivity', true);

    push('schema', 'UserDevice table', true, `rows=${await prisma.userDevice.count()}`);
    push('schema', 'UserSession table', true, `rows=${await prisma.userSession.count()}`);
    push('schema', 'RefreshToken table', true, `rows=${await prisma.refreshToken.count()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push('database', 'Prisma connectivity', false, msg.slice(0, 120));
  }
}

async function probeFoundation(): Promise<void> {
  const badRefresh = await fetchJson(`${BACKEND}/api/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'pd_rt_invalid_verify_token' }),
  });
  push(
    'foundation',
    'POST /api/auth/token/refresh rejects invalid',
    (badRefresh.body as { success?: boolean })?.success === false,
    `status=${badRefresh.status}`,
  );
}

async function main(): Promise<void> {
  console.log(`P1-06 verify — backend ${BACKEND}\n`);

  await probeDb();
  await probeIntegrationFlows();
  await probeHttpPanels();
  await probeFoundation();

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

  await cleanupEphemeralUser();

  const passed = rows.filter((r) => r.ok).length;
  console.log(`${passed}/${rows.length} checks passed`);
  process.exit(passed === rows.length ? 0 : 1);
}

void main();
