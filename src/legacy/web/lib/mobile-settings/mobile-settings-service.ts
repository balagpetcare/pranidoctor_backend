import type { MobileUserSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { authRequestContext } from "../../../../modules/auth/auth-audit.service.js";
import { recordLegalConsentFireAndForget } from "./legal-consent-audit.js";
import { loadLegalConfig, type LegalConfig } from "./legal-config.js";
import { resolveLegalConsentStatus } from "./mobile-legal-consent.js";
import { getOrCreateMobileUserSettings } from "./mobile-settings-store.js";
import type { SyncSettingsBody } from "./schemas.js";

export type { LegalConfig };

function mapSettingsDto(row: MobileUserSettings, legal: LegalConfig) {
  const status = resolveLegalConsentStatus(row, legal);

  return {
    settings: {
      theme: row.theme,
      locale: row.locale,
      privacyAcceptedVersion: row.privacyAcceptedVersion,
      privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
      termsAcceptedVersion: row.termsAcceptedVersion,
      termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
      aiAcceptedVersion: row.aiAcceptedVersion,
      aiAcceptedAt: row.aiAcceptedAt?.toISOString() ?? null,
      vetAcceptedVersion: row.vetAcceptedVersion,
      vetAcceptedAt: row.vetAcceptedAt?.toISOString() ?? null,
      emergencyAcceptedVersion: row.emergencyAcceptedVersion,
      emergencyAcceptedAt: row.emergencyAcceptedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    },
    legal: {
      privacyPolicyUrl: legal.privacyPolicyUrl,
      termsOfServiceUrl: legal.termsOfServiceUrl,
      privacyVersion: legal.privacyVersion,
      termsVersion: legal.termsVersion,
      aiConsentVersion: legal.aiConsentVersion,
      vetDisclaimerVersion: legal.vetDisclaimerVersion,
      emergencyLimitationVersion: legal.emergencyLimitationVersion,
      privacyAccepted: status.privacyAccepted,
      termsAccepted: status.termsAccepted,
      aiConsentAccepted: status.aiConsentAccepted,
      vetDisclaimerAccepted: status.vetDisclaimerAccepted,
      emergencyLimitationAccepted: status.emergencyLimitationAccepted,
      enforcePrivacyConsent: status.enforcePrivacyConsent,
      legalGateEnabled: status.legalGateEnabled,
      allRequiredAccepted: status.allRequiredAccepted,
      missing: status.missing,
      privacyRequired: !status.privacyAccepted,
      termsRequired: !status.termsAccepted,
      aiConsentRequired: !status.aiConsentAccepted,
      vetDisclaimerRequired: !status.vetDisclaimerAccepted,
      emergencyLimitationRequired: !status.emergencyLimitationAccepted,
    },
  };
}

export async function getMobileSettingsForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return mapSettingsDto(row, legal);
}

function mapLegalDocument(
  type: "privacy" | "terms" | "ai",
  row: MobileUserSettings,
  legal: LegalConfig,
) {
  if (type === "privacy") {
    return {
      type: "privacy" as const,
      version: legal.privacyVersion,
      url: legal.privacyPolicyUrl,
      title: legal.privacyTitle,
      content: legal.privacyContent,
      accepted: row.privacyAcceptedVersion === legal.privacyVersion,
      acceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    };
  }
  if (type === "terms") {
    return {
      type: "terms" as const,
      version: legal.termsVersion,
      url: legal.termsOfServiceUrl,
      title: legal.termsTitle,
      content: legal.termsContent,
      accepted: row.termsAcceptedVersion === legal.termsVersion,
      acceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    };
  }
  return {
    type: "ai" as const,
    version: legal.aiConsentVersion,
    url: legal.privacyPolicyUrl,
    title: legal.aiConsentTitle,
    content: legal.aiConsentContent,
    accepted: row.aiAcceptedVersion === legal.aiConsentVersion,
    acceptedAt: row.aiAcceptedAt?.toISOString() ?? null,
  };
}

export async function getPrivacyDocumentForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return { document: mapLegalDocument("privacy", row, legal) };
}

export async function getTermsDocumentForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return { document: mapLegalDocument("terms", row, legal) };
}

export async function getAiConsentDocumentForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return { document: mapLegalDocument("ai", row, legal) };
}

export async function syncMobileSettingsForUser(
  userId: string,
  body: SyncSettingsBody,
  request?: Request,
) {
  const legal = await loadLegalConfig();
  const now = new Date();
  const ctx = request ? authRequestContext(request) : {};

  const data: Parameters<typeof prisma.mobileUserSettings.upsert>[0]["update"] = {
    updatedAt: now,
    ...(body.theme !== undefined ? { theme: body.theme } : {}),
    ...(body.locale !== undefined ? { locale: body.locale } : {}),
  };

  if (body.acceptPrivacyVersion === legal.privacyVersion) {
    data.privacyAcceptedVersion = legal.privacyVersion;
    data.privacyAcceptedAt = now;
    recordLegalConsentFireAndForget({
      userId,
      consentType: "PRIVACY",
      version: legal.privacyVersion,
      role: "CUSTOMER",
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
    });
  }
  if (body.acceptTermsVersion === legal.termsVersion) {
    data.termsAcceptedVersion = legal.termsVersion;
    data.termsAcceptedAt = now;
    recordLegalConsentFireAndForget({
      userId,
      consentType: "TERMS",
      version: legal.termsVersion,
      role: "CUSTOMER",
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      method: "EXPLICIT_BUTTON",
    });
  }
  if (body.acceptAiVersion === legal.aiConsentVersion) {
    data.aiAcceptedVersion = legal.aiConsentVersion;
    data.aiAcceptedAt = now;
    recordLegalConsentFireAndForget({
      userId,
      consentType: "AI_PROCESSING",
      version: legal.aiConsentVersion,
      role: "CUSTOMER",
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: {
        surface: body.acceptAiSurface ?? "SETTINGS",
        kind: "AI_DISCLAIMER_ACCEPT",
      },
    });
  }
  if (body.acceptVetVersion === legal.vetDisclaimerVersion) {
    data.vetAcceptedVersion = legal.vetDisclaimerVersion;
    data.vetAcceptedAt = now;
    recordLegalConsentFireAndForget({
      userId,
      consentType: "VET_ADVICE",
      version: legal.vetDisclaimerVersion,
      role: "CUSTOMER",
      channel: "MOBILE",
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: {
        surface: body.acceptVetSurface ?? "SETTINGS",
        kind: "VET_DISCLAIMER_ACCEPT",
        ...(body.acceptVetServiceRequestId
          ? { serviceRequestId: body.acceptVetServiceRequestId }
          : {}),
      },
    });
  }
  if (body.acceptEmergencyVersion === legal.emergencyLimitationVersion) {
    data.emergencyAcceptedVersion = legal.emergencyLimitationVersion;
    data.emergencyAcceptedAt = now;
    recordLegalConsentFireAndForget({
      userId,
      consentType: "EMERGENCY_SERVICE",
      version: legal.emergencyLimitationVersion,
      role: "CUSTOMER",
      channel: "MOBILE",
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: {
        surface: body.acceptEmergencySurface ?? "SETTINGS",
        kind: "EMERGENCY_LIMITATION_ACCEPT",
        ...(body.acceptEmergencyServiceRequestId
          ? { serviceRequestId: body.acceptEmergencyServiceRequestId }
          : {}),
      },
    });
  }

  const row = await prisma.mobileUserSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });

  return mapSettingsDto(row, legal);
}

// Re-export for admin and tests
export { loadLegalConfig } from "./legal-config.js";
