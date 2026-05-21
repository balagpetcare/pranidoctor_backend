import type { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE } from "./constants";

function secureCookieDefault(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Base options for the admin session cookie (httpOnly, sameSite, path, secure). */
export function adminSessionCookieBase() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: secureCookieDefault(),
  };
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    ...adminSessionCookieBase(),
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...adminSessionCookieBase(),
    maxAge: 0,
  });
}
