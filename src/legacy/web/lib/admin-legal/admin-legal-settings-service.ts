import { prisma } from "@/lib/prisma";

import {
  DEFAULT_LEGAL,
  legalConfigToSettingJson,
  parseLegalConfigJson,
  type LegalConfig,
} from "../mobile-settings/legal-defaults.js";
import { LEGAL_SETTING_KEY, loadLegalConfig } from "../mobile-settings/legal-config.js";
import type { AdminLegalSettingsPutBody } from "./schemas.js";

export type AdminLegalSettingsDto = LegalConfig & {
  updatedAt: string | null;
};

export async function getAdminLegalSettings(): Promise<AdminLegalSettingsDto> {
  const row = await prisma.setting.findUnique({
    where: { key: LEGAL_SETTING_KEY },
    select: { valueJson: true, updatedAt: true },
  });
  const config = row?.valueJson != null ? parseLegalConfigJson(row.valueJson) : { ...DEFAULT_LEGAL };
  return {
    ...config,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAdminLegalSettings(
  body: AdminLegalSettingsPutBody,
): Promise<AdminLegalSettingsDto> {
  const current = await loadLegalConfig();
  const next: LegalConfig = {
    privacyPolicyUrl: body.privacyPolicyUrl?.trim() || current.privacyPolicyUrl,
    termsOfServiceUrl: body.termsOfServiceUrl?.trim() || current.termsOfServiceUrl,
    privacyVersion: body.privacyVersion?.trim() || current.privacyVersion,
    termsVersion: body.termsVersion?.trim() || current.termsVersion,
    aiConsentVersion: body.aiConsentVersion?.trim() || current.aiConsentVersion,
    privacyTitle: body.privacyTitle?.trim() || current.privacyTitle,
    termsTitle: body.termsTitle?.trim() || current.termsTitle,
    aiConsentTitle: body.aiConsentTitle?.trim() || current.aiConsentTitle,
    privacyContent: body.privacyContent?.trim() || current.privacyContent,
    termsContent: body.termsContent?.trim() || current.termsContent,
    aiConsentContent: body.aiConsentContent?.trim() || current.aiConsentContent,
    enforcePrivacyConsent:
      body.enforcePrivacyConsent !== undefined
        ? body.enforcePrivacyConsent
        : current.enforcePrivacyConsent,
  };

  const row = await prisma.setting.upsert({
    where: { key: LEGAL_SETTING_KEY },
    create: {
      key: LEGAL_SETTING_KEY,
      valueJson: legalConfigToSettingJson(next),
    },
    update: {
      valueJson: legalConfigToSettingJson(next),
    },
    select: { updatedAt: true },
  });

  return {
    ...next,
    updatedAt: row.updatedAt.toISOString(),
  };
}
