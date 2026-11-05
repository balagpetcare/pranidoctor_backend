/**
 * E2E validation for Admin Prescription Module (read-only).
 * Usage: npx tsx scripts/ops/verify-admin-prescriptions.mjs [baseUrl]
 */
import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, disconnectPrisma, getPrisma } from '../../src/shared/database/prisma.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const base = process.argv[2] ?? process.env.BACKEND_URL ?? 'http://localhost:3000';
const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@pranidoctor.com';
const password = process.env.ADMIN_SEED_PASSWORD ?? '12345678';

const issues = [];
const notes = [];

function record(severity, message, detail) {
  issues.push({ severity, message, detail });
}

async function login() {
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Login failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function apiGet(path, cookie) {
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

async function validateDbAndServices() {
  const prisma = getPrisma();
  const { adminListPrescriptions, adminGetPrescription, adminListPrescriptionsForServiceRequest } =
    await import('../../src/legacy/web/lib/admin-prescriptions/prescription-admin.service.ts');
  const { adminGetServiceRequest } = await import(
    '../../src/legacy/web/lib/admin-service-requests/service-request-admin-service.ts'
  );

  const dbTotal = await prisma.prescription.count();
  const dbActive = await prisma.prescription.count({ where: { status: 'ACTIVE' } });
  const dbVoided = await prisma.prescription.count({ where: { status: 'VOIDED' } });
  const withItems = await prisma.prescription.count({
    where: { items: { some: {} } },
  });
  const withDoctor = await prisma.prescription.count({
    where: { doctorId: { not: null } },
  });
  const withAi = await prisma.prescription.count({
    where: { aiTechnicianId: { not: null } },
  });
  const distinctSr = await prisma.prescription.groupBy({
    by: ['serviceRequestId'],
    _count: { id: true },
  });

  const listPage1 = await adminListPrescriptions({ limit: 25, offset: 0, sort: 'createdAt_desc' });
  const listPage2 =
    dbTotal > 25
      ? await adminListPrescriptions({ limit: 25, offset: 25, sort: 'createdAt_desc' })
      : null;

  if (listPage1.total !== dbTotal) {
    record('error', 'List total mismatch vs DB count', { api: listPage1.total, db: dbTotal });
  }
  if (listPage1.prescriptions.length > 25) {
    record('error', 'Page 1 exceeds limit', { len: listPage1.prescriptions.length });
  }
  if (listPage2) {
    const ids1 = new Set(listPage1.prescriptions.map((p) => p.id));
    const overlap = listPage2.prescriptions.filter((p) => ids1.has(p.id));
    if (overlap.length) {
      record('error', 'Pagination overlap between page 1 and 2', { overlap: overlap.map((p) => p.id) });
    }
    if (listPage1.prescriptions.length + listPage2.prescriptions.length > dbTotal) {
      record('warn', 'Paginated rows exceed total (possible sort ties)', {
        p1: listPage1.prescriptions.length,
        p2: listPage2.prescriptions.length,
        total: dbTotal,
      });
    }
  }

  const sample = listPage1.prescriptions[0];
  let detailOk = false;
  let srLinkageOk = false;
  if (sample) {
    const detail = await adminGetPrescription(sample.id);
    if (!detail) {
      record('error', 'Detail missing for list sample', { id: sample.id });
    } else {
      detailOk = true;
      const required = [
        ['prescription.id', detail.prescription?.id],
        ['patient.id', detail.patient?.id],
        ['animal.id', detail.animal?.id],
        ['serviceRequest.id', detail.serviceRequest?.id],
      ];
      for (const [label, val] of required) {
        if (!val) record('error', `Detail missing field: ${label}`, { prescriptionId: sample.id });
      }
      if (detail.prescription.id !== sample.id) {
        record('error', 'Detail prescription id mismatch', {
          list: sample.id,
          detail: detail.prescription.id,
        });
      }
      if (detail.serviceRequest.id !== sample.serviceRequestId) {
        record('error', 'Detail SR id mismatch list item', {
          list: sample.serviceRequestId,
          detail: detail.serviceRequest.id,
        });
      }
      if (detail.items.length !== sample.items.length) {
        record('warn', 'Detail items count differs from list summary', {
          id: sample.id,
          list: sample.items.length,
          detail: detail.items.length,
        });
      }

      const sr = await adminGetServiceRequest(sample.serviceRequestId);
      if (!sr) {
        record('error', 'Service request not found for prescription', {
          prescriptionId: sample.id,
          serviceRequestId: sample.serviceRequestId,
        });
      } else {
        srLinkageOk = true;
        const srRx = sr.prescriptions ?? [];
        const inSr = srRx.some((p) => p.id === sample.id);
        if (!inSr) {
          record('error', 'Prescription missing from SR detail prescriptions[]', {
            prescriptionId: sample.id,
            serviceRequestId: sample.serviceRequestId,
            srRxCount: srRx.length,
          });
        }
        const srList = await adminListPrescriptionsForServiceRequest(sample.serviceRequestId);
        if (!srList.some((p) => p.id === sample.id)) {
          record('error', 'Prescription missing from adminListPrescriptionsForServiceRequest', {
            prescriptionId: sample.id,
          });
        }
      }

      if (sample.items[0]?.medicineName) {
        const term = sample.items[0].medicineName.split(/\s+/)[0].slice(0, 8);
        if (term.length >= 3) {
          const searchRes = await adminListPrescriptions({
            limit: 25,
            offset: 0,
            search: term,
          });
          const found = searchRes.prescriptions.some((p) => p.id === sample.id);
          if (!found) {
            record('warn', 'Search did not return expected prescription', {
              term,
              sampleId: sample.id,
              hits: searchRes.prescriptions.length,
            });
          }
        }
      }
    }
  }

  const statusActive = await adminListPrescriptions({
    limit: 1,
    offset: 0,
    status: 'ACTIVE',
  });
  if (statusActive.total !== dbActive) {
    record('error', 'ACTIVE filter total mismatch', { api: statusActive.total, db: dbActive });
  }

  return {
    db: {
      dbTotal,
      dbActive,
      dbVoided,
      withItems,
      withDoctor,
      withAi,
      distinctServiceRequests: distinctSr.length,
    },
    listPage1,
    detailOk,
    srLinkageOk,
    sampleId: sample?.id ?? null,
  };
}

async function validateHttp(cookie) {
  const list = await apiGet('/api/admin/prescriptions?limit=5&offset=0', cookie);
  const detailPath = list.json?.data?.prescriptions?.[0]?.id
    ? `/api/admin/prescriptions/${list.json.data.prescriptions[0].id}`
    : null;
  const detail = detailPath ? await apiGet(detailPath, cookie) : null;
  const srId = list.json?.data?.prescriptions?.[0]?.serviceRequestId;
  const sr = srId ? await apiGet(`/api/admin/service-requests/${srId}`, cookie) : null;

  return { list, detail, sr, detailPath };
}

async function main() {
  console.log('=== Admin Prescription Module Validation ===\n');
  console.log(`HTTP base: ${base}\n`);

  let cookie = '';
  try {
    cookie = await login();
    console.log('Admin login: OK\n');
  } catch (e) {
    record('error', 'Admin login failed', e instanceof Error ? e.message : String(e));
    console.log('Admin login: FAILED\n');
  }

  let dbResult;
  try {
    dbResult = await validateDbAndServices();
    console.log('DB + service layer: OK\n');
  } catch (e) {
    record('error', 'DB/service validation failed', e instanceof Error ? e.message : String(e));
    console.error(e);
  }

  let httpResult;
  try {
    httpResult = await validateHttp(cookie);
    console.log(`HTTP list: ${httpResult.list.status}`);
    if (httpResult.detail) console.log(`HTTP detail: ${httpResult.detail.status}`);
    if (httpResult.sr) console.log(`HTTP SR detail: ${httpResult.sr.status}`);
    console.log('');
    if (httpResult.list.status === 404) {
      record(
        'error',
        'HTTP GET /api/admin/prescriptions returns 404 — backend likely needs restart after route add',
        { hint: 'Restart pranidoctor-backend dev server' },
      );
    } else if (httpResult.list.status !== 200) {
      record('error', 'HTTP list non-200', {
        status: httpResult.list.status,
        body: httpResult.list.json,
      });
    } else if (dbResult && httpResult.list.json?.data?.total !== dbResult.db.dbTotal) {
      record('error', 'HTTP list total != DB total', {
        http: httpResult.list.json?.data?.total,
        db: dbResult.db.dbTotal,
      });
    }
    if (httpResult.detail && httpResult.detail.status !== 200 && httpResult.detail.status !== 404) {
      record('error', 'HTTP detail non-200', { status: httpResult.detail.status });
    }
    if (httpResult.sr?.status === 200 && dbResult?.sampleId) {
      const rx = httpResult.sr.json?.data?.request?.prescriptions ?? [];
      if (!rx.some((p) => p.id === dbResult.sampleId)) {
        record('error', 'HTTP SR detail missing prescriptions[] entry', {
          sampleId: dbResult.sampleId,
          srRxCount: rx.length,
        });
      }
    }
  } catch (e) {
    record('error', 'HTTP validation failed', e instanceof Error ? e.message : String(e));
  }

  if (dbResult) {
    const { db, listPage1 } = dbResult;
    console.log('--- Ground truth (database) ---');
    console.log(JSON.stringify(db, null, 2));
    console.log('\n--- Admin list (service, page 1) ---');
    console.log(
      JSON.stringify(
        {
          total: listPage1.total,
          limit: listPage1.limit,
          offset: listPage1.offset,
          returned: listPage1.prescriptions.length,
          firstIds: listPage1.prescriptions.slice(0, 5).map((p) => p.id),
        },
        null,
        2,
      ),
    );

    const missingFields = [];
    for (const p of listPage1.prescriptions) {
      if (!p.customer?.displayName) missingFields.push({ id: p.id, field: 'customer.displayName' });
      if (!p.animal?.name) missingFields.push({ id: p.id, field: 'animal.name' });
      if (!p.doctor && !p.aiTechnician)
        missingFields.push({ id: p.id, field: 'doctor|aiTechnician' });
      if (!p.serviceRequest?.id) missingFields.push({ id: p.id, field: 'serviceRequest.id' });
    }
    if (missingFields.length) {
      record('warn', 'List rows with missing display fields', missingFields.slice(0, 10));
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');

  console.log('\n--- Issues ---');
  if (!issues.length) console.log('None');
  else console.log(JSON.stringify(issues, null, 2));

  console.log('\n--- Summary ---');
  console.log(
    JSON.stringify(
      {
        dbTotal: dbResult?.db.dbTotal ?? null,
        adminListTotal: dbResult?.listPage1.total ?? null,
        recordsOnPage1: dbResult?.listPage1.prescriptions.length ?? null,
        httpListStatus: httpResult?.list.status ?? null,
        errors: errors.length,
        warnings: warns.length,
        pass: errors.length === 0,
      },
      null,
      2,
    ),
  );

  process.exit(errors.length ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma().catch(() => {});
  });
