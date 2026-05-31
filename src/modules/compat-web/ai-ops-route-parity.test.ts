import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const BACKEND_ROUTES_ROOT = join(
  import.meta.dirname,
  '../../legacy/web/routes/admin/ai-ops',
);

const WEB_BFF_ROOT = join(
  import.meta.dirname,
  '../../../../pranidoctor-web/src/app/api/admin/ai-ops',
);

function walkRouteFiles(dir: string, files: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walkRouteFiles(full, files);
    } else if (name === 'route.ts') {
      files.push(full);
    }
  }
  return files;
}

/** `secrets/route.ts` → `secrets`; `secrets/[id]/test/route.ts` → `secrets/[id]/test` */
function fileToRoutePath(routeFile: string, root: string): string {
  const rel = relative(root, routeFile).replace(/\\/g, '/').replace(/\/route\.ts$/, '');
  return rel;
}

describe('ai-ops route parity', () => {
  it('backend legacy routes cover all web BFF ai-ops paths', () => {
    let webRoot = WEB_BFF_ROOT;
    try {
      statSync(webRoot);
    } catch {
      // Monorepo layout may differ in CI — skip web half if web repo not sibling.
      webRoot = join(import.meta.dirname, '../../../legacy/web/routes/admin/ai-ops');
    }

    const backendRoutes = new Set(
      walkRouteFiles(BACKEND_ROUTES_ROOT).map((f) => fileToRoutePath(f, BACKEND_ROUTES_ROOT)),
    );

    let webFiles: string[] = [];
    const webRootExists = Boolean(statSync(WEB_BFF_ROOT, { throwIfNoEntry: false }));
    if (!webRootExists) {
      throw new Error(
        `Web BFF root not found at ${WEB_BFF_ROOT}. Route parity requires pranidoctor-web sibling checkout.`,
      );
    }
    webFiles = walkRouteFiles(WEB_BFF_ROOT);

    const webRoutes = webFiles.map((f) => fileToRoutePath(f, WEB_BFF_ROOT));
    const missing = webRoutes.filter((r) => !backendRoutes.has(r));

    expect(missing, `Missing backend legacy routes: ${missing.join(', ')}`).toEqual([]);
  });
});
