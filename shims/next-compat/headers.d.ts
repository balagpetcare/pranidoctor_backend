import type { Request } from 'express';

type CookieEntry = { name: string; value: string };

type CookieJar = {
  get: (name: string) => CookieEntry | undefined;
  getAll: () => CookieEntry[];
};

export function runWithExpressRequest<T>(req: Request, fn: () => Promise<T>): Promise<T>;

export function getExpressRequest(): Request | undefined;

export function cookies(): Promise<CookieJar>;
