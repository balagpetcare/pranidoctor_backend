import { prisma } from '@/lib/prisma';

import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { legalConfigToSettingJson, LEGAL_SETTING_KEY } from '../mobile-settings/legal-defaults.js';
import {
  DEFAULT_EMERGENCY_LIMITATION_CONFIG,
  emergencyLimitationConfigToSettingJson,
  parseEmergencyLimitationConfigJson,
  type EmergencyLimitationConfig,
  type EmergencyLimitationLocaleText,
} from '../emergency-limitation/emergency-limitation-defaults.js';
import {
  EMERGENCY_LIMITATION_SETTING_KEY,
  loadEmergencyLimitationConfig,
} from '../emergency-limitation/emergency-limitation-config.js';
import {
  assertEmergencyLimitationMessaging,
} from './messaging-compliance-admin.js';
import { assertLegalSafeMessagingConfig } from '../../../../shared/compliance/messaging-compliance.js';

export type AdminEmergencyLimitationDto = EmergencyLimitationConfig & {
  consentVersion: string;
  consentTitle: string;
  updatedAt: string | null;
};

function mergeLocaleText(
  current: EmergencyLimitationLocaleText,
  patch?: Partial<EmergencyLimitationLocaleText>,
): EmergencyLimitationLocaleText {
  return {
    en: patch?.en?.trim() || current.en,
    bn: patch?.bn?.trim() || current.bn,
  };
}

export type AdminEmergencyLimitationPutBody = {
  contentVersion?: string;
  enforceAcceptance?: boolean;
  consentVersion?: string;
  consentTitle?: string;
  banner?: Partial<EmergencyLimitationLocaleText>;
  urgent?: Partial<EmergencyLimitationLocaleText>;
  full?: Partial<EmergencyLimitationLocaleText>;
  contextual?: {
    instantCare?: Partial<EmergencyLimitationLocaleText>;
    aiEmergency?: Partial<EmergencyLimitationLocaleText>;
    bookingEmergency?: Partial<EmergencyLimitationLocaleText>;
    discoveryEmergency?: Partial<EmergencyLimitationLocaleText>;
    requestPending?: Partial<EmergencyLimitationLocaleText>;
    bookingOnline?: Partial<EmergencyLimitationLocaleText>;
    phoneDial?: Partial<EmergencyLimitationLocaleText>;
  };
};

export async function getAdminEmergencyLimitationSettings(): Promise<AdminEmergencyLimitationDto> {
  const [limitationRow, legal] = await Promise.all([
    prisma.setting.findUnique({
      where: { key: EMERGENCY_LIMITATION_SETTING_KEY },
      select: { valueJson: true, updatedAt: true },
    }),
    loadLegalConfig(),
  ]);
  const config =
    limitationRow?.valueJson != null
      ? parseEmergencyLimitationConfigJson(limitationRow.valueJson)
      : { ...DEFAULT_EMERGENCY_LIMITATION_CONFIG };

  return {
    ...config,
    consentVersion: legal.emergencyLimitationVersion,
    consentTitle: legal.emergencyLimitationTitle,
    updatedAt: limitationRow?.updatedAt?.toISOString() ?? null,
  };
}

export async function updateAdminEmergencyLimitationSettings(
  body: AdminEmergencyLimitationPutBody,
): Promise<AdminEmergencyLimitationDto> {
  const [currentLimitation, currentLegal] = await Promise.all([
    loadEmergencyLimitationConfig(),
    loadLegalConfig(),
  ]);

  const nextLimitation: EmergencyLimitationConfig = {
    contentVersion: body.contentVersion?.trim() || currentLimitation.contentVersion,
    enforceAcceptance:
      body.enforceAcceptance !== undefined
        ? body.enforceAcceptance
        : currentLimitation.enforceAcceptance,
    banner: mergeLocaleText(currentLimitation.banner, body.banner),
    urgent: mergeLocaleText(currentLimitation.urgent, body.urgent),
    full: mergeLocaleText(currentLimitation.full, body.full),
    contextual: {
      instantCare: mergeLocaleText(
        currentLimitation.contextual.instantCare,
        body.contextual?.instantCare,
      ),
      aiEmergency: mergeLocaleText(
        currentLimitation.contextual.aiEmergency,
        body.contextual?.aiEmergency,
      ),
      bookingEmergency: mergeLocaleText(
        currentLimitation.contextual.bookingEmergency,
        body.contextual?.bookingEmergency,
      ),
      discoveryEmergency: mergeLocaleText(
        currentLimitation.contextual.discoveryEmergency,
        body.contextual?.discoveryEmergency,
      ),
      requestPending: mergeLocaleText(
        currentLimitation.contextual.requestPending,
        body.contextual?.requestPending,
      ),
      bookingOnline: mergeLocaleText(
        currentLimitation.contextual.bookingOnline,
        body.contextual?.bookingOnline,
      ),
      phoneDial: mergeLocaleText(
        currentLimitation.contextual.phoneDial,
        body.contextual?.phoneDial,
      ),
    },
  };

  const nextLegal = {
    ...currentLegal,
    emergencyLimitationVersion:
      body.consentVersion?.trim() || currentLegal.emergencyLimitationVersion,
    emergencyLimitationTitle:
      body.consentTitle?.trim() || currentLegal.emergencyLimitationTitle,
  };

  assertEmergencyLimitationMessaging(nextLimitation);
  if (nextLegal.emergencyLimitationTitle) {
    assertLegalSafeMessagingConfig([
      { field: 'consentTitle', text: nextLegal.emergencyLimitationTitle },
    ]);
  }

  const [limitationRow] = await Promise.all([
    prisma.setting.upsert({
      where: { key: EMERGENCY_LIMITATION_SETTING_KEY },
      create: {
        key: EMERGENCY_LIMITATION_SETTING_KEY,
        valueJson: emergencyLimitationConfigToSettingJson(nextLimitation),
      },
      update: {
        valueJson: emergencyLimitationConfigToSettingJson(nextLimitation),
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
    ...nextLimitation,
    consentVersion: nextLegal.emergencyLimitationVersion,
    consentTitle: nextLegal.emergencyLimitationTitle,
    updatedAt: limitationRow.updatedAt.toISOString(),
  };
}
