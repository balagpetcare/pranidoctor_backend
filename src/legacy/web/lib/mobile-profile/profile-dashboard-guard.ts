import type { NextResponse } from "next/server";

import { UserRole, UserStatus } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { ensureMinimalCustomerProfile } from "@/lib/mobile-customer/ensure-customer-profile";
import { prisma } from "@/lib/prisma";
import { verifyMobileJwt } from "@/lib/mobile-auth/jwt";

export type MobileProfileDashboardContextGuardCtx = {
  userId: string;
};

export type RequireMobileProfileDashboardContextUserResult =
  | { ok: true; ctx: MobileProfileDashboardContextGuardCtx }
  | { ok: false; response: NextResponse };

function extractBearer(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

/**
 * Mobile Profile tab context — same Bearer JWT as OTP login (`role: CUSTOMER` in token).
 * Allows **active** `CUSTOMER`, `AI_TECHNICIAN` (with `AiTechnicianProfile`), or `DOCTOR`
 * (with `DoctorProfile`) so the Profile tab can route before hitting customer-only `/me`.
 */
export async function requireMobileProfileDashboardContextUser(
  request: Request,
): Promise<RequireMobileProfileDashboardContextUserResult> {
  const token = extractBearer(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError(
        "UNAUTHORIZED",
        "Authorization Bearer token required",
        401,
      ),
    };
  }

  const payload = await verifyMobileJwt(token);
  if (!payload) {
    return {
      ok: false,
      response: jsonError("UNAUTHORIZED", "Invalid or expired token", 401),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      customerProfile: true,
      aiTechnicianProfile: { select: { id: true } },
      doctorProfile: { select: { id: true } },
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Account inactive or missing", 403),
    };
  }

  if (user.role === UserRole.CUSTOMER) {
    if (!user.customerProfile?.id) {
      try {
        await ensureMinimalCustomerProfile(user.id);
      } catch {
        return {
          ok: false,
          response: jsonError(
            "DATABASE_ERROR",
            "Could not initialize customer profile",
            500,
          ),
        };
      }
    }
    return { ok: true, ctx: { userId: user.id } };
  }

  if (user.role === UserRole.AI_TECHNICIAN) {
    // Never block Profile tab routing on missing linkage — dashboard-context
    // maps to GENERAL until an approved technician record exists; a 403 here
    // previously paired with mobile Dio (403) session clearing.
    return { ok: true, ctx: { userId: user.id } };
  }

  if (user.role === UserRole.DOCTOR) {
    if (!user.doctorProfile) {
      return {
        ok: false,
        response: jsonError("FORBIDDEN", "Doctor profile required", 403),
      };
    }
    return { ok: true, ctx: { userId: user.id } };
  }

  return {
    ok: false,
    response: jsonError("FORBIDDEN", "Not allowed for this account", 403),
  };
}
