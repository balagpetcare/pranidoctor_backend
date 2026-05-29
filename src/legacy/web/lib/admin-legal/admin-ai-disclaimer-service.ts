import { prisma } from '@/lib/prisma';

import {
  aiDisclaimerConfigToSettingJson,
  DEFAULT_AI_DISCLAIMER_CONFIG,
  parseAiDisclaimerConfigJson,
  type AiDisclaimerConfig,
  type AiDisclaimerLocaleText,
} from '../ai-disclaimer/ai-disclaimer-defaults.js';
import {
  AI_DISCLAIMER_SETTING_KEY,
  loadAiDisclaimerConfig,
} from '../ai-disclaimer/ai-disclaimer-config.js';
import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { legalConfigToSettingJson, LEGAL_SETTING_KEY } from '../mobile-settings/legal-defaults.js';

export type AdminAiDisclaimerDto = AiDisclaimerConfig & {
  consentVersion: string;
  consentTitle: string;
  consentContent: string;
  updatedAt: string | null;
};

function mergeLocaleText(
  current: AiDisclaimerLocaleText,
  patch?: Partial<AiDisclaimerLocaleText>,
): AiDisclaimerLocaleText {
  return {
    en: patch?.en?.trim() || current.en,
    bn: patch?.bn?.trim() || current.bn,
  };
}

export type AdminAiDisclaimerPutBody = {
  contentVersion?: string;
  enforceAcceptance?: boolean;
  consentVersion?: string;
  consentTitle?: string;
  consentContent?: string;
  banner?: Partial<AiDisclaimerLocaleText>;
  contextual?: {
    chat?: Partial<AiDisclaimerLocaleText>;
    recommendations?: Partial<AiDisclaimerLocaleText>;
    advisory?: Partial<AiDisclaimerLocaleText>;
  };
};

export async function getAdminAiDisclaimerSettings(): Promise<AdminAiDisclaimerDto> {
  const [disclaimerRow, legal] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: AI_DISCLAIMER_SETTING_KEY },
      select: { valueJson: true, updatedAt: true },
    }),
    loadLegalConfig(),
  ]);
  const config =
    disclaimerRow?.valueJson != null
      ? parseAiDisclaimerConfigJson(disclaimerRow.valueJson)
      : { ...DEFAULT_AI_DISCLAIMER_CONFIG };

  return {
    ...config,
    consentVersion: legal.aiConsentVersion,
    consentTitle: legal.aiConsentTitle,
    consentContent: legal.aiConsentContent,
    updatedAt: disclaimerRow?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAdminAiDisclaimerSettings(
  body: AdminAiDisclaimerPutBody,
): Promise<AdminAiDisclaimerDto> {
  const [currentDisclaimer, currentLegal] = await Promise.all([
    loadAiDisclaimerConfig(),
    loadLegalConfig(),
  ]);

  const nextDisclaimer: AiDisclaimerConfig = {
    contentVersion: body.contentVersion?.trim() || currentDisclaimer.contentVersion,
    enforceAcceptance:
      body.enforceAcceptance !== undefined
        ? body.enforceAcceptance
        : currentDisclaimer.enforceAcceptance,
    banner: mergeLocaleText(currentDisclaimer.banner, body.banner),
    contextual: {
      chat: mergeLocaleText(currentDisclaimer.contextual.chat, body.contextual?.chat),
      recommendations: mergeLocaleText(
        currentDisclaimer.contextual.recommendations,
        body.contextual?.recommendations,
      ),
      advisory: mergeLocaleText(
        currentDisclaimer.contextual.advisory,
        body.contextual?.advisory,
      ),
    },
  };

  const nextLegal = {
    ...currentLegal,
    aiConsentVersion: body.consentVersion?.trim() || currentLegal.aiConsentVersion,
    aiConsentTitle: body.consentTitle?.trim() || currentLegal.aiConsentTitle,
    aiConsentContent: body.consentContent?.trim() || currentLegal.aiConsentContent,
  };

  const [disclaimerRow] = await Promise.all([
    prisma.setting.upsert({
      where: { key: AI_DISCLAIMER_SETTING_KEY },
      create: {
        key: AI_DISCLAIMER_SETTING_KEY,
        valueJson: aiDisclaimerConfigToSettingJson(nextDisclaimer),
      },
      update: {
        valueJson: aiDisclaimerConfigToSettingJson(nextDisclaimer),
      },
      select: { updatedAt: true },
    }),
    prisma.setting.upsert({
      where: { key: LEGAL_SETTING_KEY },
      create: {
        key: LEGAL_SETTING_KEY,
        valueJson: legalConfigToSettingJson(nextLegal),
      },
      update: {
        valueJson: legalConfigToSettingJson(nextLegal),
      },
    }),
  ]);

  return {
    ...nextDisclaimer,
    consentVersion: nextLegal.aiConsentVersion,
    consentTitle: nextLegal.aiConsentTitle,
    consentContent: nextLegal.aiConsentContent,
    updatedAt: disclaimerRow.updatedAt.toISOString(),
  };
}
