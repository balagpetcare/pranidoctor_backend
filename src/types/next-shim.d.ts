declare module 'next/server' {
  export { NextResponse } from '../compat/next-server.js';
}

declare module 'next/headers' {
  import type { Request } from 'express';

  interface CookieEntry {
    name: string;
    value: string;
  }

  interface CookieJar {
    get: (name: string) => CookieEntry | undefined;
    getAll: () => CookieEntry[];
  }

  /** Runs a handler with the current Express request in AsyncLocalStorage. */
  export function runWithExpressRequest<T>(
    req: Request,
    fn: () => Promise<T>,
  ): Promise<T>;

  /** Current Express request when inside compat route handlers. */
  export function getExpressRequest(): Request | undefined;

  export function cookies(): Promise<CookieJar>;
}
