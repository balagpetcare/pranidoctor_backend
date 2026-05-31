/**
 * Smoke-test AI admin routes after import fixes.
 * Usage: npx tsx scripts/ops/verify-ai-admin-endpoints.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://localhost:3000';
const email = process.env.ADMIN_SEED_EMAIL ?? 'admin@pranidoctor.com';
const password = process.env.ADMIN_SEED_PASSWORD ?? '12345678';

const endpoints = [
  { method: 'GET', path: '/api/admin/ai-ops/models' },
  { method: 'GET', path: '/api/admin/ai-ops/models/families' },
  { method: 'GET', path: '/api/admin/ai-ops/providers' },
  { method: 'GET', path: '/api/admin/ai-ops/marketplace/adapters' },
  { method: 'GET', path: '/api/admin/ai-ops/marketplace/extensions' },
];

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
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  return cookie;
}

async function request(method, path, cookie, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json, text };
}

function classify(status, json) {
  const routeLoaded = status !== 405 || json?.error?.code !== 'ROUTE_MODULE_LOAD_FAILED';
  const isModuleLoadFail =
    json?.error?.code === 'ROUTE_MODULE_LOAD_FAILED' ||
    (typeof json?.error?.message === 'string' &&
      json.error.message.includes('Cannot find module'));
  const isRefError =
    typeof json?.error?.message === 'string' &&
    json.error.message.includes('requireAiAdminCapability is not defined');
  const controllerReached =
    routeLoaded &&
    !isModuleLoadFail &&
    !isRefError &&
    (status !== 500 || json?.error?.code !== 'INTERNAL_ERROR' || json?.ok === true);
  const serviceReached =
    controllerReached &&
    (status === 200 || (status === 400 && json?.error?.code === 'AI_ADMIN_ERROR'));
  return { routeLoaded: routeLoaded && !isModuleLoadFail, controllerReached, serviceReached, isModuleLoadFail, isRefError };
}

async function main() {
  console.log(`Base URL: ${base}\n`);
  let cookie = '';
  try {
    cookie = await login();
    console.log('Login: OK\n');
  } catch (e) {
    console.warn(`Login skipped: ${e instanceof Error ? e.message : e}\n(unauthenticated probes only)\n`);
  }

  const rows = [];

  for (const ep of endpoints) {
    const { status, json } = await request(ep.method, ep.path, cookie);
    const c = classify(status, json);
    rows.push({
      endpoint: `${ep.method} ${ep.path}`,
      status,
      routeLoaded: c.routeLoaded ? 'yes' : 'no',
      controllerReached: cookie && c.controllerReached ? 'yes' : cookie ? 'no' : 'n/a (no auth)',
      serviceReached: cookie && c.serviceReached ? 'yes' : cookie ? 'no' : 'n/a',
      errorCode: json?.error?.code ?? (json?.ok ? 'ok' : ''),
      message: json?.error?.message?.slice(0, 120) ?? '',
    });
  }

  let modelId = null;
  const modelsRes = await request('GET', '/api/admin/ai-ops/models', cookie);
  if (modelsRes.status === 200 && modelsRes.json?.ok && Array.isArray(modelsRes.json.data)) {
    const disabled = modelsRes.json.data.find((m) => !m.enabled);
    const any = modelsRes.json.data[0];
    modelId = (disabled ?? any)?.id ?? null;
  }

  const mutations = [
    { method: 'POST', path: `/api/admin/ai-ops/models/${modelId}/enable`, body: {} },
    { method: 'POST', path: `/api/admin/ai-ops/models/${modelId}/disable`, body: {} },
  ];

  for (const ep of mutations) {
    if (!modelId) {
      rows.push({
        endpoint: `${ep.method} ${ep.path.replace(modelId, ':id')}`,
        status: 'SKIP',
        routeLoaded: 'n/a',
        controllerReached: 'n/a',
        serviceReached: 'n/a',
        errorCode: 'NO_MODEL_ID',
        message: 'No model in DB for mutation test',
      });
      continue;
    }
    const { status, json } = await request(ep.method, ep.path, cookie, ep.body);
    const c = classify(status, json);
    rows.push({
      endpoint: `${ep.method} ${ep.path}`,
      status,
      routeLoaded: c.routeLoaded ? 'yes' : 'no',
      controllerReached: c.controllerReached ? 'yes' : 'no',
      serviceReached:
        c.serviceReached || (status === 400 && json?.error?.code === 'AI_ADMIN_ERROR') ? 'yes' : 'no',
      errorCode: json?.error?.code ?? (json?.ok ? 'ok' : ''),
      message: json?.error?.message?.slice(0, 120) ?? '',
    });
  }

  console.table(rows);

  const failed = rows.filter(
    (r) =>
      r.status === 500 &&
      (r.errorCode === 'INTERNAL_ERROR' || r.errorCode === 'ROUTE_MODULE_LOAD_FAILED'),
  );
  if (failed.length) {
    console.error('\nFailures needing investigation:');
    for (const f of failed) {
      const { json } = await request(f.endpoint.split(' ')[0], f.endpoint.split(' ').slice(1).join(' '), cookie);
      console.error(JSON.stringify({ ...f, body: json }, null, 2));
    }
    process.exit(1);
  }

  const unauth = rows.filter((r) => r.status === 401);
  if (unauth.length && !cookie) process.exit(1);
  console.log('\nAll probed routes loaded (no MODULE_NOT_FOUND / ReferenceError 500s).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
