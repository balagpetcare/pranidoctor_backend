import { prisma } from '@/lib/prisma';

import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { legalConfigToSettingJson, LEGAL_SETTING_KEY } from '../mobile-settings/legal-defaults.js';
import {
  DEFAULT_VET_DISCLAIMER_CONFIG,
  parseVetDisclaimerConfigJson,
  type VetDisclaimerConfig,
  type VetDisclaimerLocaleText,
  vetDisclaimerConfigToSettingJson,
} from '../vet-disclaimer/vet-disclaimer-defaults.js';
import {
  loadVetDisclaimerConfig,
  VET_DISCLAIMER_SETTING_KEY,
} from '../vet-disclaimer/vet-disclaimer-config.js';

export type AdminVetDisclaimerDto = VetDisclaimerConfig & {
  consentVersion: string;
  consentTitle: string;
  updatedAt: string | null;
};

function mergeLocaleText(
  current: VetDisclaimerLocaleText,
  patch?: Partial<VetDisclaimerLocaleText>,
): VetDisclaimerLocaleText {
  return {
    en: patch?.en?.trim() || current.en,
    bn: patch?.bn?.trim() || current.bn,
  };
}

export type AdminVetDisclaimerPutBody = {
  contentVersion?: string;
  enforceAcceptance?: boolean;
  consentVersion?: string;
  consentTitle?: string;
  banner?: Partial<VetDisclaimerLocaleText>;
  emergency?: Partial<VetDisclaimerLocaleText>;
  full?: Partial<VetDisclaimerLocaleText>;
  contextual?: {
    bookingHome?: Partial<VetDisclaimerLocaleText>;
    bookingEmergency?: Partial<VetDisclaimerLocaleText>;
    bookingOnline?: Partial<VetDisclaimerLocaleText>;
    treatmentJournal?: Partial<VetDisclaimerLocaleText>;
    prescriptionView?: Partial<VetDisclaimerLocaleText>;
    feedRation?: Partial<VetDisclaimerLocaleText>;
    instantCare?: Partial<VetDisclaimerLocaleText>;
  };
};

export async function getAdminVetDisclaimerSettings(): Promise<AdminVetDisclaimerDto> {
  const [disclaimerRow, legal] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: VET_DISCLAIMER_SETTING_KEY },
      select: { valueJson: true, updatedAt: true },
    }),
    loadLegalConfig(),
  ]);
  const config =
    disclaimerRow?.valueJson != null
      ? parseVetDisclaimerConfigJson(disclaimerRow.valueJson)
      : { ...DEFAULT_VET_DISCLAIMER_CONFIG };

  return {
    ...config,
    consentVersion: legal.vetDisclaimerVersion,
    consentTitle: legal.vetDisclaimerTitle,
    updatedAt: disclaimerRow?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAdminVetDisclaimerSettings(
  body: AdminVetDisclaimerPutBody,
): Promise<AdminVetDisclaimerDto> {
  const [currentDisclaimer, currentLegal] = await Promise.all([
    loadVetDisclaimerConfig(),
    loadLegalConfig(),
  ]);

  const nextDisclaimer: VetDisclaimerConfig = {
    contentVersion: body.contentVersion?.trim() || currentDisclaimer.contentVersion,
    enforceAcceptance:
      body.enforceAcceptance !== undefined
        ? body.enforceAcceptance
        : currentDisclaimer.enforceAcceptance,
    banner: mergeLocaleText(currentDisclaimer.banner, body.banner),
    emergency: mergeLocaleText(currentDisclaimer.emergency, body.emergency),
    full: mergeLocaleText(currentDisclaimer.full, body.full),
    contextual: {
      bookingHome: mergeLocaleText(
        currentDisclaimer.contextual.bookingHome,
        body.contextual?.bookingHome,
      ),
      bookingEmergency: mergeLocaleText(
        currentDisclaimer.contextual.bookingEmergency,
        body.contextual?.bookingEmergency,
      ),
      bookingOnline: mergeLocaleText(
        currentDisclaimer.contextual.bookingOnline,
        body.contextual?.bookingOnline,
      ),
      treatmentJournal: mergeLocaleText(
        currentDisclaimer.contextual.treatmentJournal,
        body.contextual?.treatmentJournal,
      ),
      prescriptionView: mergeLocaleText(
        currentDisclaimer.contextual.prescriptionView,
        body.contextual?.prescriptionView,
      ),
      feedRation: mergeLocaleText(
        currentDisclaimer.contextual.feedRation,
        body.contextual?.feedRation,
      ),
      instantCare: mergeLocaleText(
        currentDisclaimer.contextual.instantCare,
        body.contextual?.instantCare,
      ),
    },
  };

  const nextLegal = {
    ...currentLegal,
    vetDisclaimerVersion: body.consentVersion?.trim() || currentLegal.vetDisclaimerVersion,
    vetDisclaimerTitle: body.consentTitle?.trim() || currentLegal.vetDisclaimerTitle,
  };

  const [disclaimerRow] = await Promise.all([
    prisma.setting.upsert({
      where: { key: VET_DISCLAIMER_SETTING_KEY },
      create: {
        key: VET_DISCLAIMER_SETTING_KEY,
        valueJson: vetDisclaimerConfigToSettingJson(nextDisclaimer),
      },
      update: {
        valueJson: vetDisclaimerConfigToSettingJson(nextDisclaimer),
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
    consentVersion: nextLegal.vetDisclaimerVersion,
    consentTitle: nextLegal.vetDisclaimerTitle,
    updatedAt: disclaimerRow.updatedAt.toISOString(),
  };
}
