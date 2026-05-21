/**
 * P1-09 verification — device register, list, revoke HTTP + session bind + refresh guard.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { AuthAuditAction } from '../src/generated/prisma/index.js';
import { issueMobileCredentials } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { getRefreshTokenService } from '../src/modules/auth/refresh-token.service.js';
import { isRefreshRejectRevokedDeviceEnabled } from '../src/modules/auth/device.config.js';

loadEnvironment();

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ??
  'http://localhost:3000';

type Row = { name: string; ok: boolean; detail?: string };
const rows: Row[] = [];

function push(name: string, ok: boolean, detail?: string): void {
  rows.push({ name, ok, detail });
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

async function main(): Promise<void> {
  console.log(`P1-09 verify — ${BACKEND}\n`);

  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });
  const prisma = getPrisma();

  const suffix = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `p1-09-${suffix}@local.test`,
      phone: `018${String(suffix).slice(-8).padStart(8, '0')}`,
      passwordHash: '$2a$12$placeholder',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customerProfile: { create: { displayName: 'P1-09 Verify' } },
    },
    select: { id: true },
  });

  try {
    const creds = await issueMobileCredentials(user.id, undefined, {
      deviceKey: `p1-09-inline-${suffix}`,
      platform: 'android',
    });
    push('issue credentials', !!creds.accessToken && !!creds.sessionId);

    const badJson = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ platform: 'android' }),
    });
    push(
      'register validation (missing deviceKey)',
      badJson.status === 422 && (badJson.body as { ok?: boolean })?.ok === false,
      `status=${badJson.status}`,
    );

    const badPlatform = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceKey: `p1-09-key-${suffix}`, platform: 'symbian' }),
    });
    push(
      'register validation (invalid platform)',
      badPlatform.status === 422,
      `status=${badPlatform.status}`,
    );

    const authHeaders = {
      Authorization: `Bearer ${creds.accessToken}`,
      'Content-Type': 'application/json',
    };
    const deviceKey = `p1-09-register-${suffix}`;

    const reg = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        deviceKey,
        platform: 'android',
        pushToken: 'test-push-v1',
        appVersion: '1.0.0-p1-09',
      }),
    });
    const regData = (
      reg.body as {
        ok?: boolean;
        data?: { deviceId?: string; registered?: boolean; replaced?: boolean };
      }
    )?.data;
    push(
      'device register',
      reg.status === 200 &&
        (reg.body as { ok?: boolean })?.ok === true &&
        !!regData?.deviceId &&
        regData?.registered === true &&
        regData?.replaced !== true,
      `status=${reg.status} id=${regData?.deviceId ?? 'none'}`,
    );

    const sessionRow = creds.sessionId
      ? await prisma.userSession.findUnique({
          where: { id: creds.sessionId },
          select: { deviceId: true },
        })
      : null;
    push(
      'session bind (deviceId on session)',
      sessionRow?.deviceId === regData?.deviceId,
      `sessionDevice=${sessionRow?.deviceId ?? 'none'}`,
    );

    const auditReg = await prisma.authAuditEvent.findFirst({
      where: { userId: user.id, action: AuthAuditAction.DEVICE_REGISTERED },
      orderBy: { createdAt: 'desc' },
    });
    push('audit DEVICE_REGISTERED', auditReg != null);

    const replace = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        deviceKey,
        platform: 'android',
        pushToken: 'test-push-v2',
        appVersion: '1.0.1-p1-09',
      }),
    });
    const replaceData = (
      replace.body as {
        ok?: boolean;
        data?: { deviceId?: string; replaced?: boolean; registered?: boolean };
      }
    )?.data;
    const replaceRow = regData?.deviceId
      ? await prisma.userDevice.findUnique({
          where: { id: regData.deviceId },
          select: { pushToken: true, appVersion: true, revokedAt: true },
        })
      : null;
    push(
      'device replace',
      replace.status === 200 &&
        replaceData?.replaced === true &&
        replaceData?.deviceId === regData?.deviceId &&
        replaceRow?.revokedAt == null &&
        replaceRow?.pushToken === 'test-push-v2',
      `status=${replace.status} replaced=${String(replaceData?.replaced)}`,
    );

    if (!regData?.deviceId) {
      push('device revoke', false, 'no deviceId');
      push('audit DEVICE_REVOKED', false, 'skipped');
      push('device restore', false, 'skipped');
      push('GET /api/mobile/devices', false, 'skipped');
    } else {
      const del = await fetchJson(`${BACKEND}/api/mobile/devices/${regData.deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const revokedRow = await prisma.userDevice.findUnique({
        where: { id: regData.deviceId },
        select: { revokedAt: true },
      });
      push(
        'device revoke',
        del.status === 200 &&
          (del.body as { ok?: boolean; data?: { revoked?: boolean } })?.data?.revoked === true &&
          revokedRow?.revokedAt != null,
        `status=${del.status}`,
      );

      const auditRev = await prisma.authAuditEvent.findFirst({
        where: { userId: user.id, action: AuthAuditAction.DEVICE_REVOKED },
        orderBy: { createdAt: 'desc' },
      });
      push('audit DEVICE_REVOKED', auditRev != null);

      const listAfterRevoke = await fetchJson(`${BACKEND}/api/mobile/devices`, {
        headers: { Authorization: `Bearer ${creds.accessToken}` },
      });
      const listedAfterRevoke = (
        listAfterRevoke.body as { ok?: boolean; data?: { devices?: { id: string }[] } }
      )?.data?.devices;
      push(
        'revoked device hidden from list',
        !listedAfterRevoke?.some((d) => d.id === regData.deviceId),
        `count=${listedAfterRevoke?.length ?? 0}`,
      );

      const credsAfterRevoke = await issueMobileCredentials(user.id, undefined, {
        deviceKey: `p1-09-restore-session-${suffix}`,
        platform: 'android',
      });
      const restore = await fetchJson(`${BACKEND}/api/mobile/devices/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credsAfterRevoke.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceKey,
          platform: 'ios',
          pushToken: 'test-push-restored',
        }),
      });
      const restoreData = (
        restore.body as { ok?: boolean; data?: { deviceId?: string; registered?: boolean } }
      )?.data;
      const restoredRow = await prisma.userDevice.findUnique({
        where: { id: regData.deviceId },
        select: { revokedAt: true, platform: true, pushToken: true },
      });
      push(
        'device restore',
        restore.status === 200 &&
          restoreData?.deviceId === regData.deviceId &&
          restoredRow?.revokedAt == null &&
          restoredRow?.platform === 'ios',
        `status=${restore.status}`,
      );

      const list = await fetchJson(`${BACKEND}/api/mobile/devices`, {
        headers: { Authorization: `Bearer ${credsAfterRevoke.accessToken}` },
      });
      const devices = (list.body as { ok?: boolean; data?: { devices?: { id: string }[] } })?.data
        ?.devices;
      push(
        'GET /api/mobile/devices',
        list.status === 200 &&
          (list.body as { ok?: boolean })?.ok === true &&
          Array.isArray(devices) &&
          devices.some((d) => d.id === regData.deviceId),
        `count=${devices?.length ?? 0}`,
      );

      if (creds.refreshToken && isRefreshRejectRevokedDeviceEnabled()) {
        const refreshAfter = await fetchJson(`${BACKEND}/api/mobile/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: creds.refreshToken }),
        });
        push(
          'refresh rejects revoked device',
          refreshAfter.status === 401 || (refreshAfter.body as { ok?: boolean })?.ok === false,
          `status=${refreshAfter.status}`,
        );
      } else {
        push(
          'refresh rejects revoked device',
          true,
          'skipped (REFRESH_REJECT_REVOKED_DEVICE off)',
        );
      }
    }
  } finally {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.userDevice.deleteMany({ where: { userId: user.id } });
    await prisma.userSession.deleteMany({ where: { userId: user.id } });
    await prisma.authAuditEvent.deleteMany({ where: { userId: user.id } });
    await prisma.customerProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  for (const r of rows) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  const passed = rows.filter((r) => r.ok).length;
  const total = rows.length;
  console.log(`\n${passed}/${total} checks passed`);
  const allPass = passed === total;
  console.log(`P1_09_VERIFY=${allPass ? 'PASS' : 'FAIL'}`);
  console.log(`DEVICE_READY=${allPass ? 'YES' : 'NO'}`);
  console.log('NEXT_STEP=P1-11 (i18n auth error catalog)');
  process.exit(allPass ? 0 : 1);
}

void main();
