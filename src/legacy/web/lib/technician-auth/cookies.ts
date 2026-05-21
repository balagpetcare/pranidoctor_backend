import type { NextResponse } from "next/server";

import { TECHNICIAN_SESSION_COOKIE, TECHNICIAN_SESSION_MAX_AGE } from "./constants";

function secureCookieDefault(): boolean {
  return process.env.NODE_ENV === "production";
}

export function technicianSessionCookieBase() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: secureCookieDefault(),
  };
}

export function setTechnicianSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(TECHNICIAN_SESSION_COOKIE, token, {
    ...technicianSessionCookieBase(),
    maxAge: TECHNICIAN_SESSION_MAX_AGE,
  });
}

export function clearTechnicianSessionCookie(res: NextResponse): void {
  res.cookies.set(TECHNICIAN_SESSION_COOKIE, "", {
    ...technicianSessionCookieBase(),
    maxAge: 0,
  });
}
