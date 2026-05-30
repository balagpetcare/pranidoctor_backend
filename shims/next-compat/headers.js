import { AsyncLocalStorage } from 'node:async_hooks';

/** @type {import('node:async_hooks').AsyncLocalStorage<import('express').Request>} */
const requestStore = new AsyncLocalStorage();

/**
 * @param {import('express').Request} req
 * @param {() => Promise<unknown>} fn
 */
export function runWithExpressRequest(req, fn) {
  return requestStore.run(req, fn);
}

/** Current Express request when inside compat route handlers. */
export function getExpressRequest() {
  return requestStore.getStore();
}

/** @param {string} header */
function parseCookieHeader(header) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.includes('%') ? decodeURIComponent(raw) : raw;
    if (name) out[name] = value;
  }
  return out;
}

export async function cookies() {
  const req = requestStore.getStore();
  const parsed = parseCookieHeader(req?.headers.cookie ?? '');

  return {
    /** @param {string} name */
    get(name) {
      const value = parsed[name];
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return Object.entries(parsed).map(([name, value]) => ({ name, value }));
    },
  };
}
