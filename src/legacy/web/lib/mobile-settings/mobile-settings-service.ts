import type { MobileUserSettings } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { SyncSettingsBody } from "./schemas";

export type LegalConfig = {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
  privacyVersion: string;
  termsVersion: string;
  privacyTitle: string;
  termsTitle: string;
  privacyContent: string;
  termsContent: string;
};

const DEFAULT_LEGAL: LegalConfig = {
  privacyPolicyUrl:
    process.env.MOBILE_PRIVACY_POLICY_URL?.trim() || "https://pranidoctor.com/privacy",
  termsOfServiceUrl:
    process.env.MOBILE_TERMS_OF_SERVICE_URL?.trim() || "https://pranidoctor.com/terms",
  privacyVersion: "2026-05-01",
  termsVersion: "2026-05-01",
  privacyTitle: "Privacy Policy",
  termsTitle: "Terms of Service",
  privacyContent:
    "Prani Doctor respects your privacy. We collect account and farm data to provide veterinary and farm management services. Contact support to exercise data rights.",
  termsContent:
    "By using Prani Doctor you agree to use the app for lawful farm management purposes. AI guidance is informational only and not a substitute for professional veterinary care.",
};

export async function loadLegalConfig(): Promise<LegalConfig> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: "mobile.legal.config" },
      select: { valueJson: true },
    });
    const j = row?.valueJson;
    if (j !== null && typeof j === "object" && !Array.isArray(j)) {
      const o = j as Record<string, unknown>;
      return {
        privacyPolicyUrl:
          typeof o.privacyPolicyUrl === "string" && o.privacyPolicyUrl.trim()
            ? o.privacyPolicyUrl.trim()
            : DEFAULT_LEGAL.privacyPolicyUrl,
        termsOfServiceUrl:
          typeof o.termsOfServiceUrl === "string" && o.termsOfServiceUrl.trim()
            ? o.termsOfServiceUrl.trim()
            : DEFAULT_LEGAL.termsOfServiceUrl,
        privacyVersion:
          typeof o.privacyVersion === "string" && o.privacyVersion.trim()
            ? o.privacyVersion.trim()
            : DEFAULT_LEGAL.privacyVersion,
        termsVersion:
          typeof o.termsVersion === "string" && o.termsVersion.trim()
            ? o.termsVersion.trim()
            : DEFAULT_LEGAL.termsVersion,
        privacyTitle:
          typeof o.privacyTitle === "string" && o.privacyTitle.trim()
            ? o.privacyTitle.trim()
            : DEFAULT_LEGAL.privacyTitle,
        termsTitle:
          typeof o.termsTitle === "string" && o.termsTitle.trim()
            ? o.termsTitle.trim()
            : DEFAULT_LEGAL.termsTitle,
        privacyContent:
          typeof o.privacyContent === "string" && o.privacyContent.trim()
            ? o.privacyContent.trim()
            : DEFAULT_LEGAL.privacyContent,
        termsContent:
          typeof o.termsContent === "string" && o.termsContent.trim()
            ? o.termsContent.trim()
            : DEFAULT_LEGAL.termsContent,
      };
    }
  } catch {
    /* optional */
  }
  return DEFAULT_LEGAL;
}

function mapSettingsDto(row: MobileUserSettings, legal: LegalConfig) {
  const privacyAccepted =
    row.privacyAcceptedVersion != null &&
    row.privacyAcceptedVersion === legal.privacyVersion;
  const termsAccepted =
    row.termsAcceptedVersion != null && row.termsAcceptedVersion === legal.termsVersion;

  return {
    settings: {
      theme: row.theme,
      locale: row.locale,
      privacyAcceptedVersion: row.privacyAcceptedVersion,
      privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
      termsAcceptedVersion: row.termsAcceptedVersion,
      termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    },
    legal: {
      privacyPolicyUrl: legal.privacyPolicyUrl,
      termsOfServiceUrl: legal.termsOfServiceUrl,
      privacyVersion: legal.privacyVersion,
      termsVersion: legal.termsVersion,
      privacyAccepted,
      termsAccepted,
    },
  };
}

async function getOrCreateSettings(userId: string): Promise<MobileUserSettings> {
  const existing = await prisma.mobileUserSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.mobileUserSettings.create({ data: { userId } });
}

export async function getMobileSettingsForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateSettings(userId), loadLegalConfig()]);
  return mapSettingsDto(row, legal);
}

export async function getPrivacyDocumentForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateSettings(userId), loadLegalConfig()]);
  return {
    document: {
      type: "privacy" as const,
      version: legal.privacyVersion,
      url: legal.privacyPolicyUrl,
      title: legal.privacyTitle,
      content: legal.privacyContent,
      accepted: row.privacyAcceptedVersion === legal.privacyVersion,
      acceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    },
  };
}

export async function getTermsDocumentForUser(userId: string) {
  const [row, legal] = await Promise.all([getOrCreateSettings(userId), loadLegalConfig()]);
  return {
    document: {
      type: "terms" as const,
      version: legal.termsVersion,
      url: legal.termsOfServiceUrl,
      title: legal.termsTitle,
      content: legal.termsContent,
      accepted: row.termsAcceptedVersion === legal.termsVersion,
      acceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    },
  };
}

export async function syncMobileSettingsForUser(userId: string, body: SyncSettingsBody) {
  const legal = await loadLegalConfig();
  const now = new Date();

  const data: Parameters<typeof prisma.mobileUserSettings.upsert>[0]["update"] = {
    updatedAt: now,
    ...(body.theme !== undefined ? { theme: body.theme } : {}),
    ...(body.locale !== undefined ? { locale: body.locale } : {}),
  };

  if (body.acceptPrivacyVersion === legal.privacyVersion) {
    data.privacyAcceptedVersion = legal.privacyVersion;
    data.privacyAcceptedAt = now;
  }
  if (body.acceptTermsVersion === legal.termsVersion) {
    data.termsAcceptedVersion = legal.termsVersion;
    data.termsAcceptedAt = now;
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
