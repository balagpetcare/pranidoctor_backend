/**
 * One-shot codemod: add requireAiAdminCapability to legacy ai-ops routes.
 * Safe to re-run (skips handlers that already enforce capabilities).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routesRoot = path.join(root, 'src/legacy/web/routes/admin/ai-ops');

const ANALYTICS_VIEW = [
  '/analytics/usage/dashboard',
  '/analytics/usage/daily-cost',
  '/analytics/usage/monthly-cost',
  '/analytics/usage/trends',
  '/analytics/usage/features',
  '/analytics/usage/providers',
  '/analytics/risk',
  '/usage/users/',
  '/usage/customers/',
];

function relPosix(filePath) {
  return path.relative(routesRoot, filePath).replace(/\\/g, '/');
}

function capabilityFor(rel, method) {
  if (rel.includes('/foundation/sync-env')) return 'ai.foundation.manage';
  if (rel.includes('/settings/') && method !== 'GET') return 'ai.settings.manage';
  if (rel.includes('/analytics/usage/report') && method === 'GET') return 'ai.analytics.export';
  if (ANALYTICS_VIEW.some((s) => rel.includes(s))) return 'ai.analytics.view';
  if (method === 'GET') return 'ai.ops.view';
  return 'ai.registry.manage';
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === 'route.ts') acc.push(full);
  }
  return acc;
}

function ensureImport(src) {
  if (src.includes('requireAiAdminCapability')) return src;
  if (src.includes("from '../../../../../../modules/ai/admin/index.js'")) {
    return src.replace(
      /(\{[^}]*?)requireAiAdminActor([^}]*\} from ['"][^'"]*modules\/ai\/admin\/index\.js['"];)/,
      '$1requireAiAdminCapability$2',
    );
  }
  if (src.includes("from '../../../../../../../../modules/ai/admin/index.js'")) {
    return src.replace(
      /(\{[^}]*?)requireAiAdminActor([^}]*\} from ['"][^'"]*modules\/ai\/admin\/index\.js['"];)/,
      '$1requireAiAdminCapability$2',
    );
  }
  if (src.includes("from '../../../../../../modules/ai/admin/ai-admin.guard.js'")) {
    src = src.replace(
      /import \{ requireAiAdminActor \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/modules\/ai\/admin\/ai-admin\.guard\.js';/,
      "import { requireAiAdminCapability } from '../../../../../../modules/ai/admin/index.js';",
    );
    src = src.replace(
      /import \{([^}]*?)requireAiAdminActor([^}]*)\} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/modules\/ai\/admin\/ai-admin\.guard\.js';/,
      "import {$1requireAiAdminCapability$2} from '../../../../../../modules/ai/admin/index.js';",
    );
  }
  return src;
}

function patchHandler(src, method, capability) {
  const fnRe = new RegExp(
    `(export async function ${method}\\([^)]*\\) \\{)([\\s\\S]*?)(\\n\\})`,
    'g',
  );
  return src.replace(fnRe, (full, head, body, tail) => {
    if (body.includes('assertAiAdminCan') || body.includes('requireAiAdminCapability(')) {
      return full;
    }
    if (!body.includes('requireAiAdminActor()')) return full;
    const nextBody = body.replace(
      /const auth = await requireAiAdminActor\(\);\s*\n(\s*)if \(!auth\.ok\) return auth\.response;/,
      `const auth = await requireAiAdminCapability('${capability}');\n$1if (!auth.ok) return auth.response;`,
    );
    if (nextBody === body) return full;
    return `${head}${nextBody}${tail}`;
  });
}

function patchFile(filePath) {
  const rel = relPosix(filePath);
  if (rel.includes('foundation/sync-env') || rel.includes('settings/')) {
    return { filePath, status: 'skipped-existing' };
  }

  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('requireAiAdminActor()')) {
    return { filePath, status: 'no-auth' };
  }
  if (src.includes('assertAiAdminCan')) {
    return { filePath, status: 'skipped-existing' };
  }

  const methods = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);
  if (methods.length === 0) return { filePath, status: 'no-methods' };

  let next = src;
  for (const method of methods) {
    next = patchHandler(next, method, capabilityFor(rel, method));
  }
  if (next === src) return { filePath, status: 'unchanged' };

  next = ensureImport(next);
  fs.writeFileSync(filePath, next);
  return { filePath, status: 'patched', methods };
}

const results = walk(routesRoot).map(patchFile);
const patched = results.filter((r) => r.status === 'patched');
console.log(`Patched ${patched.length} route files`);
for (const r of patched) {
  console.log(`  ${relPosix(r.filePath)} [${r.methods.join(', ')}]`);
}
