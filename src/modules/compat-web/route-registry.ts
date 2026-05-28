import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Router } from 'express';

import { wrapNextHandler } from './next-adapter.js';

const ROUTES_ROOT = join(import.meta.dirname, '../../legacy/web/routes');

type RouteHandlerExports = {
  GET?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
  POST?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
  PUT?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
  PATCH?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
  DELETE?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
  OPTIONS?: (
    request: globalThis.Request,
    context?: { params: Promise<Record<string, string>> },
  ) => Promise<globalThis.Response> | globalThis.Response;
};

function walkRouteFiles(dir: string, files: string[] = []): string[] {
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

/** `mobile/me/route.ts` → `/api/mobile/me` */
export function fileToExpressPath(routeFile: string): string {
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

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

function lazyLegacyHandler(routeFile: string, method: (typeof METHODS)[number]) {
  let handler: RouteHandlerExports[(typeof METHODS)[number]] | undefined;
  let loadError: unknown;

  const load = async () => {
    if (handler || loadError) return;
    try {
      const mod = (await import(pathToFileURL(routeFile).href)) as RouteHandlerExports;
      handler = mod[method];
    } catch (error) {
      loadError = error;
      throw error;
    }
  };

  return wrapNextHandler(async (webReq, context) => {
    await load();
    if (!handler) {
      return new Response(null, { status: 405 });
    }
    return handler(webReq, context);
  });
}

/** Registers legacy paths; handlers load on first request (faster/safer startup). */
export async function registerLegacyWebRoutes(router: Router): Promise<number> {
  const files = walkRouteFiles(ROUTES_ROOT).sort((a, b) => {
    const depth = (p: string) => fileToExpressPath(p).split('/').filter(Boolean).length;
    return depth(b) - depth(a);
  });
  let count = 0;

  for (const file of files) {
    const expressPath = fileToExpressPath(file);
    for (const method of METHODS) {
      const wrapped = lazyLegacyHandler(file, method);
      switch (method) {
        case 'GET':
          router.get(expressPath, wrapped);
          break;
        case 'POST':
          router.post(expressPath, wrapped);
          break;
        case 'PUT':
          router.put(expressPath, wrapped);
          break;
        case 'PATCH':
          router.patch(expressPath, wrapped);
          break;
        case 'DELETE':
          router.delete(expressPath, wrapped);
          break;
        case 'OPTIONS':
          router.options(expressPath, wrapped);
          break;
        default:
          break;
      }
      count += 1;
    }
  }

  return count;
}

export function listRegisteredPaths(): string[] {
  return walkRouteFiles(ROUTES_ROOT).map(fileToExpressPath);
}
