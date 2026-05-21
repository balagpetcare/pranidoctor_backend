import type { NextResponse } from "next/server";

import { DOCTOR_SESSION_COOKIE, DOCTOR_SESSION_MAX_AGE } from "./constants";

function secureCookieDefault(): boolean {
  return process.env.NODE_ENV === "production";
}

export function doctorSessionCookieBase() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: secureCookieDefault(),
  };
}

export function setDoctorSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(DOCTOR_SESSION_COOKIE, token, {
    ...doctorSessionCookieBase(),
    maxAge: DOCTOR_SESSION_MAX_AGE,
  });
}

export function clearDoctorSessionCookie(res: NextResponse): void {
  res.cookies.set(DOCTOR_SESSION_COOKIE, "", {
    ...doctorSessionCookieBase(),
    maxAge: 0,
  });
}
