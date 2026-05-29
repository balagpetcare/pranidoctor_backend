import type { NextResponse } from "next/server";

import { UserRole, UserStatus } from "@/generated/prisma/client";
import { authJsonError } from "../../../../modules/auth/i18n/compat-error.js";
import { ensureMinimalCustomerProfile } from "@/lib/mobile-customer/ensure-customer-profile";
import { prisma } from "@/lib/prisma";

import { AUTH_CHANNELS } from "../../../../modules/auth/identity-core.js";
import {
  assertJwtSessionActive,
  touchJwtSession,
} from "../../../../modules/auth/session-guard.helper.js";

import { verifyMobileJwt } from "./jwt";
import {
  getMobileLegalConsentStatusForUser,
  isPrivacyConsentEnforced,
  isPrivacyConsentExemptPath,
} from "@/lib/mobile-settings/mobile-legal-consent";
import { loadLegalConfig } from "@/lib/mobile-settings/legal-config";

export type MobileCustomerContext = {
  userId: string;
  customerProfileId: string;
  /** Panel/mobile JWT session id (`sid`) when issued with session binding. */
  sessionId?: string;
  profileLocale?: string | null;
};

export type RequireMobileCustomerResult =
  | { ok: true; ctx: MobileCustomerContext }
  | { ok: false; response: NextResponse };

function extractBearer(request: Request): string | null {
  const raw = request.headers.get("authorization")?.trim();
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return m?.[1]?.trim() || null;
}

/**
 * Requires `Authorization: Bearer <jwt>` issued for audience `mobile` and role `CUSTOMER`,
 * with an active user. If no `CustomerProfile` exists yet, creates a minimal one.
 * Admin cookies are ignored.
 */
export async function requireMobileCustomer(
  request: Request,
): Promise<RequireMobileCustomerResult> {
  const token = extractBearer(request);
  if (!token) {
    return {
      ok: false,
      response: authJsonError(request, "UNAUTHORIZED", 401, {
        messageKey: "UNAUTHORIZED_BEARER_REQUIRED",
      }),
    };
  }

  const payload = await verifyMobileJwt(token);
  if (!payload) {
    return {
      ok: false,
      response: authJsonError(request, "UNAUTHORIZED", 401, {
        messageKey: "UNAUTHORIZED",
      }),
    };
  }

  const guard = await assertJwtSessionActive(payload, AUTH_CHANNELS.mobile);
  if (guard === "revoked") {
    return {
      ok: false,
      response: authJsonError(request, "UNAUTHORIZED", 401, {
        messageKey: "UNAUTHORIZED",
      }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { customerProfile: { select: { id: true, locale: true } } },
  });

  if (!user || user.role !== UserRole.CUSTOMER || user.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      response: authJsonError(request, "FORBIDDEN", 403, {
        messageKey: "FORBIDDEN_CUSTOMER_REQUIRED",
        profileLocale: user?.customerProfile?.locale,
      }),
    };
  }

  let customerProfileId = user.customerProfile?.id;
  if (!customerProfileId) {
    try {
      customerProfileId = await ensureMinimalCustomerProfile(user.id);
    } catch {
      return {
        ok: false,
        response: authJsonError(request, "DATABASE_ERROR", 500, {
          messageKey: "DATABASE_ERROR",
          profileLocale: user.customerProfile?.locale,
        }),
      };
    }
  }

  await touchJwtSession(payload);

  const legal = await loadLegalConfig();
  const enforceLegal =
    legal.legalGateEnabled &&
    process.env.LEGAL_ENFORCEMENT_ENABLED?.trim().toLowerCase() === "true";

  if ((isPrivacyConsentEnforced(legal) || enforceLegal) && !isPrivacyConsentExemptPath(request)) {
    const consent = await getMobileLegalConsentStatusForUser(user.id);
    const missing = [...consent.missing];
    if (enforceLegal) {
      if (!consent.termsAccepted && !missing.includes("terms")) missing.push("terms");
      if (!consent.privacyAccepted && !missing.includes("privacy")) missing.push("privacy");
    } else if (!consent.privacyAccepted && !missing.includes("privacy")) {
      missing.push("privacy");
    }

    const blocked =
      missing.includes("privacy") || (enforceLegal && missing.includes("terms"));
    if (blocked) {
      return {
        ok: false,
        response: authJsonError(request, "LEGAL_CONSENT_REQUIRED", 403, {
          messageKey: undefined,
          message: "Legal acceptance required",
          details: {
            missing: enforceLegal
              ? missing.filter((m) => m === "privacy" || m === "terms")
              : ["privacy"],
            privacyVersion: consent.privacyVersion,
            termsVersion: consent.termsVersion,
            aiConsentVersion: consent.aiConsentVersion,
          },
          profileLocale: user.customerProfile?.locale,
        }),
      };
    }
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      customerProfileId,
      sessionId: payload.sid,
      profileLocale: user.customerProfile?.locale,
    },
  };
}
