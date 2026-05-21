import type { NextResponse } from "next/server";

import { AiTechnicianStatus, UserRole, UserStatus } from "@/generated/prisma/client";
import { jsonError } from "@/lib/api-response";
import { ensureMinimalCustomerProfile } from "@/lib/mobile-customer/ensure-customer-profile";
import { prisma } from "@/lib/prisma";
import { verifyMobileJwt } from "@/lib/mobile-auth/jwt";

export type MobileAiTechnicianModuleContext = {
  userId: string;
  /** Present for `UserRole.CUSTOMER`; may be null for `AI_TECHNICIAN` if profile was promoted without legacy row. */
  customerProfileId: string | null;
};

export type RequireMobileAiTechnicianModuleUserResult =
  | { ok: true; ctx: MobileAiTechnicianModuleContext }
  | { ok: false; response: NextResponse };

function extractBearer(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

/**
 * Same Bearer mobile JWT as customer OTP (`role: CUSTOMER` in token).
 * Allows **active** `UserRole.CUSTOMER` with `CustomerProfile`, or **active**
 * `UserRole.AI_TECHNICIAN` with an `AiTechnicianProfile` (published pipeline).
 */
export async function requireMobileAiTechnicianModuleUser(
  request: Request,
): Promise<RequireMobileAiTechnicianModuleUserResult> {
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
    include: { customerProfile: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Account inactive or missing", 403),
    };
  }

  if (user.role === UserRole.CUSTOMER) {
    let customerProfileId = user.customerProfile?.id ?? null;
    if (!customerProfileId) {
      try {
        customerProfileId = await ensureMinimalCustomerProfile(user.id);
      } catch {
        return {
          ok: false,
          response: jsonError(
            "DATABASE_ERROR",
            "গ্রাহক প্রোফাইল তৈরি করা যায়নি",
            500,
          ),
        };
      }
    }
    return {
      ok: true,
      ctx: {
        userId: user.id,
        customerProfileId,
      },
    };
  }

  if (user.role === UserRole.AI_TECHNICIAN) {
    const tech = await prisma.aiTechnicianProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!tech) {
      return {
        ok: false,
        response: jsonError(
          "FORBIDDEN",
          "AI technician profile required",
          403,
        ),
      };
    }
    return {
      ok: true,
      ctx: {
        userId: user.id,
        customerProfileId: user.customerProfile?.id ?? null,
      },
    };
  }

  return {
    ok: false,
    response: jsonError("FORBIDDEN", "Not allowed for this account", 403),
  };
}

export type MobileAiTechnicianActorContext = {
  userId: string;
  technicianProfileId: string;
};

export type RequireMobileAiTechnicianActorResult =
  | { ok: true; ctx: MobileAiTechnicianActorContext }
  | { ok: false; response: NextResponse };

/**
 * Bearer mobile JWT; **only** `UserRole.AI_TECHNICIAN` with an
 * **APPROVED** or **PUBLISHED** `AiTechnicianProfile` (handles job lifecycle).
 */
export async function requireMobileAiTechnicianActor(
  request: Request,
): Promise<RequireMobileAiTechnicianActorResult> {
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
    select: { id: true, role: true, status: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "Account inactive or missing", 403),
    };
  }

  if (user.role !== UserRole.AI_TECHNICIAN) {
    return {
      ok: false,
      response: jsonError(
        "FORBIDDEN",
        "এআই টেকনিশিয়ান অ্যাকাউন্ট প্রয়োজন",
        403,
      ),
    };
  }

  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  });

  if (!profile) {
    return {
      ok: false,
      response: jsonError("FORBIDDEN", "এআই টেকনিশিয়ান প্রোফাইল নেই", 403),
    };
  }

  if (
    profile.status !== AiTechnicianStatus.APPROVED &&
    profile.status !== AiTechnicianStatus.PUBLISHED
  ) {
    return {
      ok: false,
      response: jsonError(
        "FORBIDDEN",
        "অনুমোদন বা প্রকাশিত প্রোফাইল প্রয়োজন",
        403,
        { profileStatus: profile.status },
      ),
    };
  }

  return {
    ok: true,
    ctx: { userId: user.id, technicianProfileId: profile.id },
  };
}
