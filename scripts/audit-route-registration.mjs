#!/usr/bin/env node
/**
 * Audits Express route registration: compat legacy inflation, duplicates, modular mounts.
 * Usage: node scripts/audit-route-registration.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ROUTES_ROOT = join(ROOT, 'src/legacy/web/routes');
const MODULES_ROOT = join(ROOT, 'src/modules');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function walkRouteFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkRouteFiles(full, files);
    else if (name === 'route.ts') files.push(full);
  }
  return files;
}

function fileToExpressPath(routeFile) {
  const rel = relative(ROUTES_ROOT, routeFile).replace(/\\/g, '/');
  const withoutRoute = rel.replace(/\/route\.ts$/, '');
  const segments = withoutRoute.split('/').map((s) => {
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1);
      if (inner.startsWith('...')) return `*${inner.slice(3)}`;
      return `:${inner}`;
    }
    return s;
  });
  return `/${segments.join('/')}`;
}

function detectExportedMethods(source) {
  const found = new Set();
  for (const m of METHODS) {
    if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(source)) found.add(m);
    if (new RegExp(`export\\s+function\\s+${m}\\b`).test(source)) found.add(m);
  }
  return found;
}

function walkModuleRouteFiles(dir, files = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      if (statSync(full).isDirectory()) walkModuleRouteFiles(full, files);
      else if (name.endsWith('.routes.ts')) files.push(full);
    } catch {
      /* skip */
    }
  }
  return files;
}

function countExpressRoutesInModuleFile(filePath, modulePrefix) {
  const src = readFileSync(filePath, 'utf8');
  const routes = [];
  const re = /router\.(get|post|put|patch|delete|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    let p = m[2];
    if (!p.startsWith('/')) p = `/${p}`;
    routes.push({ method, path: `/api/${modulePrefix}${p}`, source: relative(ROOT, filePath) });
  }
  return routes;
}

function moduleNameFromPath(filePath) {
  const rel = relative(MODULES_ROOT, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  return parts[0] ?? 'unknown';
}

// --- Legacy compat ---
const routeFiles = walkRouteFiles(ROUTES_ROOT);
const pathToFiles = new Map();
let totalRegisteredCompat = 0;
let totalImplementedCompat = 0;
const phantomByMethod = Object.fromEntries(METHODS.map((m) => [m, 0]));

for (const file of routeFiles) {
  const expressPath = fileToExpressPath(file);
  const list = pathToFiles.get(expressPath) ?? [];
  list.push(relative(ROOT, file));
  pathToFiles.set(expressPath, list);

  const src = readFileSync(file, 'utf8');
  const implemented = detectExportedMethods(src);
  for (const method of METHODS) {
    totalRegisteredCompat += 1;
    if (implemented.has(method)) {
      totalImplementedCompat += 1;
    } else {
      phantomByMethod[method] += 1;
    }
  }
}

const duplicatePaths = [...pathToFiles.entries()].filter(([, files]) => files.length > 1);

// Prefix stats
const prefixCounts = new Map();
for (const p of pathToFiles.keys()) {
  const top = p.split('/').filter(Boolean)[0] ?? '(root)';
  prefixCounts.set(top, (prefixCounts.get(top) ?? 0) + 1);
}

// --- Modular ---
const moduleRouteFiles = walkModuleRouteFiles(MODULES_ROOT);
const modularRoutes = [];
const moduleMounts = new Set();
for (const f of moduleRouteFiles) {
  const mod = moduleNameFromPath(f);
  moduleMounts.add(mod);
  modularRoutes.push(...countExpressRoutesInModuleFile(f, mod));
}

// Health + metrics (manual)
const infraRoutes = [
  { method: 'GET', path: '/health', source: 'api/health' },
  { method: 'POST', path: '/health', source: 'api/health' },
  { method: 'GET', path: '/ready', source: 'api/health' },
  { method: 'GET', path: '/live', source: 'api/health' },
  { method: 'GET', path: '/health/db', source: 'api/health' },
  { method: 'GET', path: '/health/redis', source: 'api/health' },
  { method: 'GET', path: '/health/storage', source: 'api/health' },
  { method: 'GET', path: '/health/cache', source: 'api/health' },
  { method: 'GET', path: '/health/queue', source: 'api/health' },
  { method: 'GET', path: '/health/ai', source: 'api/health' },
  { method: 'GET', path: '/health/ai/providers', source: 'api/health' },
  { method: 'GET', path: '/health/modules', source: 'api/health' },
  { method: 'GET', path: '/health/mobile', source: 'api/health' },
  { method: 'GET', path: '/health/dependencies', source: 'api/health' },
  { method: 'GET', path: '/metrics', source: 'api/metrics' },
  { method: 'GET', path: '/api/docs', source: 'api/docs' },
];

const allRoutes = [];
for (const method of METHODS) {
  for (const p of pathToFiles.keys()) {
    allRoutes.push({ method, path: `/api${p}`, layer: 'compat', implemented: null });
  }
}
for (const r of modularRoutes) allRoutes.push({ ...r, layer: 'module' });
for (const r of infraRoutes) allRoutes.push({ ...r, layer: 'infra' });

// Cross-layer path+method collisions (compat vs module)
const keyCount = new Map();
for (const r of allRoutes) {
  const key = `${r.method} ${r.path}`;
  const arr = keyCount.get(key) ?? [];
  arr.push(r);
  keyCount.set(key, arr);
}
const crossLayerDuplicates = [...keyCount.entries()].filter(([, arr]) => {
  const layers = new Set(arr.map((x) => x.layer));
  return arr.length > 1 && layers.size > 1;
});

const compatOnlyDuplicates = [...keyCount.entries()].filter(([, arr]) => {
  return arr.length > 1 && arr.every((x) => x.layer === 'compat');
});

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    legacyRouteFiles: routeFiles.length,
    compatRegisteredSlots: totalRegisteredCompat,
    compatImplementedHandlers: totalImplementedCompat,
    compatPhantomSlots: totalRegisteredCompat - totalImplementedCompat,
    uniqueCompatPaths: pathToFiles.size,
    duplicateCompatPathMappings: duplicatePaths.length,
    modularRouteFiles: moduleRouteFiles.length,
    modularRouteHandlers: modularRoutes.length,
    moduleMountCount: moduleMounts.size,
    infraRoutes: infraRoutes.length,
    estimatedTotalRegistered: totalRegisteredCompat + modularRoutes.length + infraRoutes.length + 1,
  },
  why2718: {
    formula: 'legacy route.ts files × 6 HTTP methods',
    calculation: `${routeFiles.length} × 6 = ${routeFiles.length * 6}`,
    matchesReported2718: routeFiles.length * 6 === 2718,
  },
  phantomMethods: phantomByMethod,
  topCompatPrefixes: [...prefixCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([prefix, pathCount]) => ({ prefix, uniquePaths: pathCount, registeredSlots: pathCount * 6 })),
  duplicateExpressPaths: duplicatePaths.map(([path, files]) => ({ expressPath: path, files })),
  crossLayerCollisions: crossLayerDuplicates.slice(0, 50).map(([key, arr]) => ({
    route: key,
    layers: arr.map((x) => ({ layer: x.layer, source: x.source })),
  })),
  moduleMounts: [...moduleMounts].sort(),
  recommendations: [],
};

if (report.why2718.matchesReported2718) {
  report.recommendations.push(
    '2718 is not 2718 unique endpoints — it registers 6 methods per legacy route.ts file regardless of implementation.',
  );
}
report.recommendations.push(
  `Reduce ${totalRegisteredCompat - totalImplementedCompat} phantom compat slots by registering only exported methods.`,
);
report.recommendations.push(
  'Split admin/ai-ops legacy tree into modular Express routers when BFF migration completes.',
);
if (crossLayerDuplicates.length > 0) {
  report.recommendations.push(
    `Review ${crossLayerDuplicates.length} compat vs module path collisions — compat mounts first in server.ts.`,
  );
}

console.log(JSON.stringify(report, null, 2));
