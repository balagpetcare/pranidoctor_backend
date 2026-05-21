import type { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-response";
import { classifyAdminPanelAuth } from "@/lib/admin-auth/panel-classify";
import { resolveAdminPanelActor } from "@/lib/admin-auth/panel-access";
import { getAdminSession } from "@/lib/admin-auth/session";
import { classifyDoctorPanelAuth } from "@/lib/doctor-auth/panel-classify";
import { resolveDoctorPanelActor } from "@/lib/doctor-auth/panel-access";
import { getDoctorSession } from "@/lib/doctor-auth/session";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import { classifyTechnicianPanelAuth } from "@/lib/technician-auth/panel-classify";
import { resolveTechnicianPanelActor } from "@/lib/technician-auth/panel-access";
import { getTechnicianSession } from "@/lib/technician-auth/session";

export type NotificationViewerContext = {
  userId: string;
};

export type RequireNotificationViewerResult =
  | { ok: true; ctx: NotificationViewerContext }
  | { ok: false; response: NextResponse };

function wantsBearerAuth(request: Request): boolean {
  const raw = request.headers.get("authorization")?.trim();
  return !!raw && /^Bearer\s+/i.test(raw);
}

/**
 * Authenticates one of: mobile customer Bearer JWT, doctor cookie, admin cookie, technician cookie.
 * When `Authorization: Bearer` is present, only mobile JWT is attempted (invalid token → 401, no cookie fallback).
 */
export async function requireNotificationViewer(
  request: Request,
): Promise<RequireNotificationViewerResult> {
  if (wantsBearerAuth(request)) {
    const mobile = await requireMobileCustomer(request);
    if (!mobile.ok) return mobile;
    return { ok: true, ctx: { userId: mobile.ctx.userId } };
  }

  const doctorSession = await getDoctorSession();
  const doctorActor = doctorSession
    ? await resolveDoctorPanelActor(doctorSession)
    : null;
  if (classifyDoctorPanelAuth(doctorSession, doctorActor) === "ok") {
    return { ok: true, ctx: { userId: doctorActor!.userId } };
  }

  const adminSession = await getAdminSession();
  const adminActor = adminSession
    ? await resolveAdminPanelActor(adminSession)
    : null;
  if (classifyAdminPanelAuth(adminSession, adminActor) === "ok") {
    return { ok: true, ctx: { userId: adminActor!.id } };
  }

  const techSession = await getTechnicianSession();
  const techActor = techSession
    ? await resolveTechnicianPanelActor(techSession)
    : null;
  if (classifyTechnicianPanelAuth(techSession, techActor) === "ok") {
    return { ok: true, ctx: { userId: techActor!.userId } };
  }

  return {
    ok: false,
    response: jsonError(
      "UNAUTHORIZED",
      "Sign in required (mobile Bearer token or panel session)",
      401,
    ),
  };
}
