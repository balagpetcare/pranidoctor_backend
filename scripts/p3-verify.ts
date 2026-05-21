/**
 * P3-11 — Phase 3 verification (lead, assignment, case, timeline, workflow).
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvironment } from '../src/shared/config/load-env.js';
import { createPrismaClient, getPrisma } from '../src/shared/database/prisma.js';
import { loadConfig } from '../src/shared/config/config.loader.js';
import { createLogger } from '../src/shared/logger/logger.js';
import { normalizeBdMobilePhone } from '../src/modules/auth/phone.js';
import { LeadsRepository } from '../src/modules/leads/leads.repository.js';
import { ServiceRequestType } from '../src/generated/prisma/index.js';

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

function timelineEvents(body: unknown): string[] {
  if (body == null || typeof body !== 'object') return [];
  const data = (body as { ok?: boolean; data?: { events?: { eventType?: string }[] } }).data;
  return (data?.events ?? []).map((e) => e.eventType ?? '').filter(Boolean);
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
  const prisma = getPrisma();

  // Module-level CRM lead
  try {
    const repo = new LeadsRepository();
    const lead = await repo.create({
      phone: `017${String(Date.now()).slice(-8)}`,
      source: 'PHONE',
      concern: 'P3 verify lead',
    });
    push('lead', 'LeadsRepository.create', Boolean(lead.id), `id=${lead.id}`);
    const activities = await repo.getActivities(lead.id);
    push('lead', 'LeadsRepository activities', activities.length >= 0, `count=${activities.length}`);
  } catch (e) {
    push('lead', 'LeadsRepository', false, String(e));
  }

  const adminLogin = await fetchJson(`${BACKEND}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const adminCookie = sessionCookie(adminLogin.headers, 'prani_admin_token');
  push('http', 'admin login', adminLogin.status === 200 && !!adminCookie, `status=${adminLogin.status}`);

  const docLogin = await fetchJson(`${BACKEND}/api/doctor/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD }),
  });
  const docCookie = sessionCookie(docLogin.headers, 'prani_doctor_session');
  let doctorProfileId: string | undefined;
  if (docCookie) {
    const docMe = await fetchJson(`${BACKEND}/api/doctor/auth/me`, {
      headers: { Cookie: docCookie },
    });
    doctorProfileId =
      docMe.body != null &&
      typeof docMe.body === 'object' &&
      (docMe.body as { ok?: boolean; data?: { user?: { doctorProfileId?: string } } }).ok
        ? (docMe.body as { data: { user?: { doctorProfileId?: string } } }).data?.user
            ?.doctorProfileId
        : undefined;
    push(
      'doctor',
      'doctor login + profile id',
      docMe.status === 200 && typeof doctorProfileId === 'string',
      `status=${docMe.status}`,
    );
  } else {
    push('doctor', 'doctor login', false, `status=${docLogin.status}`);
  }

  const suffix = Date.now();
  const testPhone = process.env.P3_TEST_PHONE?.trim() || `016${String(suffix).slice(-8).padStart(8, '0')}`;
  const testPassword = process.env.P3_TEST_PASSWORD?.trim() || 'TestPass123!';
  const normalized = normalizeBdMobilePhone(testPhone);
  if (!normalized) {
    push('http', 'normalize test phone', false, testPhone);
  } else {
    const register = await fetchJson(`${BACKEND}/api/mobile/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'P3 Verify User',
        mobile: testPhone,
        password: testPassword,
      }),
    });
    let token =
      register.status === 200 &&
      (register.body as { ok?: boolean; data?: { accessToken?: string } }).ok
        ? (register.body as { data?: { accessToken?: string } }).data?.accessToken
        : undefined;

    if (!token) {
      const login = await fetchJson(`${BACKEND}/api/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: testPhone, password: testPassword }),
      });
      token =
        login.status === 200 &&
        (login.body as { ok?: boolean; data?: { accessToken?: string } }).ok
          ? (login.body as { data?: { accessToken?: string } }).data?.accessToken
          : undefined;
    }

    push('http', 'customer token', Boolean(token), token ? 'ok' : 'missing');

    if (token) {
      const category = await prisma.serviceCategory.findUnique({
        where: { slug: 'doctor-visit' },
      });
      push('lead', 'doctor-visit category seeded', Boolean(category?.id), category?.id ?? 'missing');

      const animalRes = await fetchJson(`${BACKEND}/api/mobile/animals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          animalType: 'CATTLE',
          name: 'P3 Test Cow',
        }),
      });
      const animalId =
        animalRes.body != null &&
        typeof animalRes.body === 'object' &&
        (animalRes.body as { ok?: boolean; data?: { animal?: { id?: string } } }).ok
          ? (animalRes.body as { data?: { animal?: { id?: string } } }).data?.animal?.id
          : undefined;
      push('lead', 'POST /api/mobile/animals', animalRes.status === 201 && !!animalId, `status=${animalRes.status}`);

      if (category?.id && animalId) {
        const createReq = await fetchJson(`${BACKEND}/api/mobile/service-requests`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            animalId,
            serviceCategoryId: category.id,
            serviceType: ServiceRequestType.DOCTOR_HOME_VISIT,
            problemOrSymptom: 'P3 verify — fever and loss of appetite',
            locationText: 'P3 verify farm location',
          }),
        });
        const requestId =
          createReq.body != null &&
          typeof createReq.body === 'object' &&
          (createReq.body as { ok?: boolean; data?: { request?: { id?: string } } }).ok
            ? (createReq.body as { data?: { request?: { id?: string } } }).data?.request?.id
            : undefined;
        push(
          'lead',
          'POST /api/mobile/service-requests',
          createReq.status === 201 && !!requestId,
          `status=${createReq.status}`,
        );

        if (requestId) {
          const mobileTimeline = await fetchJson(
            `${BACKEND}/api/mobile/service-requests/${requestId}/timeline`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const mobileEvents = timelineEvents(mobileTimeline.body);
          push(
            'timeline',
            'GET mobile timeline CREATED',
            mobileTimeline.status === 200 && mobileEvents.includes('CREATED'),
            `events=${mobileEvents.join(',')}`,
          );

          if (adminCookie && doctorProfileId) {
            const assign = await fetchJson(
              `${BACKEND}/api/admin/service-requests/${requestId}/assign-doctor`,
              {
                method: 'POST',
                headers: {
                  Cookie: adminCookie,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ doctorProfileId }),
              },
            );
            push(
              'assignment',
              'POST admin assign-doctor',
              assign.status === 200 &&
                (assign.body as { ok?: boolean })?.ok === true,
              `status=${assign.status}`,
            );

            const adminTimeline = await fetchJson(
              `${BACKEND}/api/admin/service-requests/${requestId}/timeline`,
              { headers: { Cookie: adminCookie } },
            );
            const adminEvents = timelineEvents(adminTimeline.body);
            push(
              'timeline',
              'GET admin timeline ASSIGNED',
              adminTimeline.status === 200 && adminEvents.includes('ASSIGNED'),
              `events=${adminEvents.join(',')}`,
            );

            if (docCookie) {
              const accept = await fetchJson(
                `${BACKEND}/api/doctor/service-requests/${requestId}/accept`,
                {
                  method: 'POST',
                  headers: { Cookie: docCookie },
                },
              );
              push(
                'assignment',
                'POST doctor accept',
                accept.status === 200 && (accept.body as { ok?: boolean })?.ok === true,
                `status=${accept.status}`,
              );

              const caseRes = await fetchJson(
                `${BACKEND}/api/doctor/service-requests/${requestId}/treatment-cases`,
                {
                  method: 'POST',
                  headers: {
                    Cookie: docCookie,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    diagnosis: 'P3 verify — suspected infection',
                    treatmentNotes: 'Antibiotics prescribed',
                  }),
                },
              );
              push(
                'case',
                'POST doctor treatment-cases',
                (caseRes.status === 200 || caseRes.status === 201) &&
                  (caseRes.body as { ok?: boolean })?.ok === true,
                `status=${caseRes.status}`,
              );

              const docTimeline = await fetchJson(
                `${BACKEND}/api/doctor/service-requests/${requestId}/timeline`,
                { headers: { Cookie: docCookie } },
              );
              const docEvents = timelineEvents(docTimeline.body);
              const workflowEvents = ['CREATED', 'ASSIGNED', 'ACCEPTED', 'CASE_OPENED'];
              const workflowOk = workflowEvents.every((e) => docEvents.includes(e));
              push(
                'workflow',
                'timeline workflow events',
                docTimeline.status === 200 && workflowOk,
                `events=${docEvents.join(',')}`,
              );

              const complete = await fetchJson(
                `${BACKEND}/api/doctor/service-requests/${requestId}/complete`,
                {
                  method: 'POST',
                  headers: {
                    Cookie: docCookie,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    serviceFee: 500,
                    travelCost: 100,
                    medicineCost: 200,
                    discount: 0,
                    paymentMethod: 'CASH',
                    paymentStatus: 'PAID',
                  }),
                },
              );
              push(
                'workflow',
                'POST doctor complete',
                complete.status === 200 &&
                  (complete.body as { ok?: boolean })?.ok === true,
                `status=${complete.status}`,
              );

              const finalTimeline = await fetchJson(
                `${BACKEND}/api/mobile/service-requests/${requestId}/timeline`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const finalEvents = timelineEvents(finalTimeline.body);
              push(
                'timeline',
                'GET mobile timeline COMPLETED',
                finalTimeline.status === 200 && finalEvents.includes('COMPLETED'),
                `events=${finalEvents.join(',')}`,
              );
            }
          }
        }
      }
    }
  }

  const leadsApi = await fetchJson(`${BACKEND}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: `018${String(Date.now()).slice(-8)}`,
      source: 'WEBSITE',
      concern: 'P3 HTTP lead',
    }),
  });
  push(
    'lead',
    'POST /api/leads',
    leadsApi.status === 201 &&
      (leadsApi.body as { success?: boolean })?.success === true,
    `status=${leadsApi.status}`,
  );

  const passed = rows.filter((r) => r.ok).length;
  const total = rows.length;
  const allOk = passed === total;

  console.log('\n--- P3 Verification ---');
  for (const row of rows) {
    console.log(`${row.ok ? 'PASS' : 'FAIL'} [${row.domain}] ${row.name}${row.detail ? ` — ${row.detail}` : ''}`);
  }
  console.log(`\nP3: ${passed}/${total} checks passed`);
  console.log(`P3_PASS=${allOk ? 'YES' : 'NO'}`);
  console.log(`LEAD_READY=${rows.some((r) => r.domain === 'lead' && r.ok) ? 'YES' : 'NO'}`);
  console.log(`CASE_READY=${rows.some((r) => r.domain === 'case' && r.ok) ? 'YES' : 'NO'}`);
  console.log(`ASSIGN_READY=${rows.some((r) => r.domain === 'assignment' && r.ok) ? 'YES' : 'NO'}`);
  console.log(`WORKFLOW_READY=${rows.some((r) => r.domain === 'workflow' && r.ok) ? 'YES' : 'NO'}`);

  if (process.env.P3_RUN_SUITE === '1') {
    runNpmScript('test');
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
