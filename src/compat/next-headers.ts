import { AsyncLocalStorage } from 'node:async_hooks';

import type { Request } from 'express';

const requestStore = new AsyncLocalStorage<Request>();

export function runWithExpressRequest<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  return requestStore.run(req, fn);
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = decodeURIComponent(trimmed.slice(eq + 1).trim());
    if (name) out[name] = value;
  }
  return out;
}

type CookieEntry = { name: string; value: string };

type CookieJar = {
  get: (name: string) => CookieEntry | undefined;
  getAll: () => CookieEntry[];
};

export async function cookies(): Promise<CookieJar> {
  const req = requestStore.getStore();
  const parsed = parseCookieHeader(req?.headers.cookie ?? '');

  return {
    get(name: string) {
      const value = parsed[name];
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return Object.entries(parsed).map(([name, value]) => ({ name, value }));
    },
  };
}
