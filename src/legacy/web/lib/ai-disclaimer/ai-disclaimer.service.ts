import type { MobileUserSettings } from '@/generated/prisma/client';

import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { resolveLegalConsentStatus } from '../mobile-settings/mobile-legal-consent.js';
import { getOrCreateMobileUserSettings } from '../mobile-settings/mobile-settings-store.js';
import { loadAiDisclaimerConfig } from './ai-disclaimer-config.js';
import {
  pickDisclaimerLocaleText,
  type AiDisclaimerFeatureKey,
  type AiDisclaimerLocale,
} from './ai-disclaimer-defaults.js';

export type AiDisclaimerMobileDto = {
  version: string;
  contentVersion: string;
  enforceAcceptance: boolean;
  accepted: boolean;
  acceptedAt: string | null;
  title: string;
  full: { en: string; bn: string };
  banner: { en: string; bn: string };
  contextual: {
    chat: { en: string; bn: string };
    recommendations: { en: string; bn: string };
    advisory: { en: string; bn: string };
  };
};

export async function getAiDisclaimerForUser(userId: string): Promise<AiDisclaimerMobileDto> {
  const [row, legal, disclaimer] = await Promise.all([
    getOrCreateMobileUserSettings(userId),
    loadLegalConfig(),
    loadAiDisclaimerConfig(),
  ]);
  const status = resolveLegalConsentStatus(row, legal);

  return {
    version: legal.aiConsentVersion,
    contentVersion: disclaimer.contentVersion,
    enforceAcceptance: disclaimer.enforceAcceptance,
    accepted: status.aiConsentAccepted,
    acceptedAt: row.aiAcceptedAt?.toISOString() ?? null,
    title: legal.aiConsentTitle,
    full: {
      en: legal.aiConsentContent,
      bn: legal.aiConsentContent,
    },
    banner: disclaimer.banner,
    contextual: disclaimer.contextual,
  };
}

export async function resolveFeatureDisclaimerText(
  feature: AiDisclaimerFeatureKey,
  locale: AiDisclaimerLocale,
): Promise<string> {
  const disclaimer = await loadAiDisclaimerConfig();
  return pickDisclaimerLocaleText(disclaimer.contextual[feature], locale);
}

export async function resolveBannerDisclaimerText(locale: AiDisclaimerLocale): Promise<string> {
  const disclaimer = await loadAiDisclaimerConfig();
  return pickDisclaimerLocaleText(disclaimer.banner, locale);
}

export async function isAiDisclaimerAcceptanceRequired(
  row: Pick<
    MobileUserSettings,
    | 'privacyAcceptedVersion'
    | 'termsAcceptedVersion'
    | 'aiAcceptedVersion'
    | 'vetAcceptedVersion'
    | 'emergencyAcceptedVersion'
  >,
): Promise<boolean> {
  const [legal, disclaimer] = await Promise.all([loadLegalConfig(), loadAiDisclaimerConfig()]);
  if (!disclaimer.enforceAcceptance) return false;
  const status = resolveLegalConsentStatus(row, legal);
  return !status.aiConsentAccepted;
}

export { pickDisclaimerLocaleText };
