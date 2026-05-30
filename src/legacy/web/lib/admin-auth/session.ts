import { cookies, getExpressRequest } from "next/headers";

import { ADMIN_SESSION_COOKIE } from './constants.js';
import { verifyAdminToken, type AdminJwtPayload } from './jwt.js';

/** Reads raw cookie values (no URI decoding — JWT must stay intact). */
export function readAdminSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const prefix = `${ADMIN_SESSION_COOKIE}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const value = trimmed.slice(prefix.length);
    return value.length > 0 ? value : null;
  }
  return null;
}

/** Prefer Fetch `Request` cookies on compat routes (Express ALS can miss the header). */
export async function getAdminSessionFromRequest(
  request: Request,
): Promise<AdminJwtPayload | null> {
  const token = readAdminSessionTokenFromCookieHeader(request.headers.get('cookie'));
  if (!token) return null;
  return verifyAdminToken(token);
}

async function getAdminSessionFromExpressRequest(): Promise<AdminJwtPayload | null> {
  const expressReq = getExpressRequest();
  const token = readAdminSessionTokenFromCookieHeader(
    typeof expressReq?.headers?.cookie === 'string' ? expressReq.headers.cookie : undefined,
  );
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function getAdminSession(request?: Request): Promise<AdminJwtPayload | null> {
  if (request) {
    const fromRequest = await getAdminSessionFromRequest(request);
    if (fromRequest) return fromRequest;
  }

  const fromExpress = await getAdminSessionFromExpressRequest();
  if (fromExpress) return fromExpress;

  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
