/**
 * P1-04 / P1-05 — doctor & technician auth verification.
 */
import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { getPrisma } from '../src/shared/database/prisma.js';
import { SessionStatus } from '../src/generated/prisma/index.js';
import { toDoctorMeUser, toTechnicianMeUser } from '../src/modules/auth/panel-auth.dto.js';
import { PanelDoctorAuthService } from '../src/modules/auth/services/panel-doctor-auth.service.js';
import { PanelTechnicianAuthService } from '../src/modules/auth/services/panel-technician-auth.service.js';
import { revokeLatestPanelSession } from '../src/modules/auth/panel-session.helper.js';
import { recordPanelSession } from '../src/modules/auth/mobile-auth-credentials.service.js';
import { AuthChannel } from '../src/generated/prisma/index.js';

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
  return body != null && typeof (body as { ok?: boolean }).ok === 'boolean';
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

async function probeHttp(): Promise<void> {
  const doctorBad = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'p1-04-invalid@test.local', password: 'wrong' }),
  });
  const doctorCode = (doctorBad.body as { error?: { code?: string } })?.error?.code;
  push(
    'doctor',
    'login invalid envelope',
    hasCompatEnvelope(doctorBad.body) &&
      (doctorBad.body as { ok: boolean }).ok === false &&
      typeof doctorCode === 'string',
    `status=${doctorBad.status} code=${doctorCode}`,
  );

  const doctorLogout = await fetchJson(`${BACKEND}/api/doctor/auth/logout`, { method: 'POST' });
  push(
    'doctor',
    'logout envelope',
    doctorLogout.status === 200 && (doctorLogout.body as { ok?: boolean })?.ok === true,
    `status=${doctorLogout.status}`,
  );

  const doctorMe = await fetchJson(`${BACKEND}/api/doctor/auth/me`);
  push(
    'doctor',
    'me unauthenticated',
    doctorMe.status === 401 && (doctorMe.body as { error?: { code?: string } })?.error?.code === 'UNAUTHORIZED',
    `status=${doctorMe.status}`,
  );

  const techBad = await fetchJson(`${BACKEND}/api/technician/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'p1-04-invalid@test.local', password: 'wrong' }),
  });
  const techCode = (techBad.body as { error?: { code?: string } })?.error?.code;
  push(
    'technician',
    'login invalid envelope',
    hasCompatEnvelope(techBad.body) &&
      (techBad.body as { ok: boolean }).ok === false &&
      typeof techCode === 'string',
    `status=${techBad.status} code=${techCode}`,
  );

  const techLogout = await fetchJson(`${BACKEND}/api/technician/auth/logout`, { method: 'POST' });
  push(
    'technician',
    'logout envelope',
    techLogout.status === 200 && (techLogout.body as { ok?: boolean })?.ok === true,
  );

  const techMe = await fetchJson(`${BACKEND}/api/technician/auth/me`);
  push(
    'technician',
    'me unauthenticated',
    techMe.status === 401,
    `status=${techMe.status}`,
  );
}

async function probeMeDto(): Promise<void> {
  const doctorSvc = new PanelDoctorAuthService();
  const actor = await doctorSvc.resolveActor({
    sub: 'nonexistent',
    email: 'x@test.com',
    role: 'DOCTOR',
  });
  push('doctor', 'resolveActor null for missing user', actor === null);

  const meShape = toDoctorMeUser({
    userId: 'u1',
    doctorProfileId: 'p1',
    email: 'd@t.com',
    displayName: 'D',
    providerStatus: 'ACTIVE',
  });
  push(
    'doctor',
    'me DTO uses id not userId',
    meShape.id === 'u1' && !('userId' in meShape),
    `keys=${Object.keys(meShape).join(',')}`,
  );
  push(
    'doctor',
    'me DTO includes providerStatus',
    meShape.providerStatus === 'ACTIVE' && meShape.role === 'DOCTOR',
  );

  const techMe = toTechnicianMeUser({
    userId: 'u2',
    aiTechnicianProfileId: 'p2',
    email: 't@t.com',
    displayName: null,
    providerStatus: 'PENDING_VERIFICATION',
  });
  push(
    'technician',
    'me DTO uses id + providerStatus',
    techMe.id === 'u2' && techMe.providerStatus === 'PENDING_VERIFICATION',
  );
}

async function probeSessionLogout(): Promise<void> {
  const prisma = getPrisma();

  const suffix = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `p1-04-panel-${suffix}@local.test`,
      passwordHash: '$2a$12$placeholder',
      role: 'DOCTOR',
      status: 'ACTIVE',
      doctorProfile: {
        create: {
          licenseNumber: `LIC-${suffix}`,
          providerStatus: 'ACTIVE',
        },
      },
    },
    select: { id: true },
  });

  await recordPanelSession(user.id, 'doctor_panel');
  const activeBefore = await prisma.userSession.count({
    where: { userId: user.id, status: SessionStatus.ACTIVE, channel: AuthChannel.DOCTOR_PANEL },
  });

  const revoked = await revokeLatestPanelSession(user.id, 'doctor_panel', 'logout');
  const activeAfter = await prisma.userSession.count({
    where: { userId: user.id, status: SessionStatus.ACTIVE, channel: AuthChannel.DOCTOR_PANEL },
  });

  push(
    'session',
    'revokeLatestPanelSession',
    activeBefore > 0 && revoked && activeAfter === 0,
    `before=${activeBefore} after=${activeAfter}`,
  );

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.userSession.deleteMany({ where: { userId: user.id } });
  await prisma.doctorProfile.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}

async function initDb(): Promise<void> {
  const config = loadConfig();
  createLogger(config);
  createPrismaClient({ config });
  await getPrisma().$queryRaw`SELECT 1`;
}

async function main(): Promise<void> {
  console.log(`P1-04/05 verify — backend ${BACKEND}\n`);

  try {
    await initDb();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push('database', 'Prisma init', false, msg.slice(0, 120));
  }

  await probeMeDto();
  try {
    await probeSessionLogout();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    push('session', 'revokeLatestPanelSession', false, msg.slice(0, 120));
  }
  await probeHttp();

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
  console.log(`${passed}/${rows.length} checks passed`);
  process.exit(passed === rows.length ? 0 : 1);
}

void main();
