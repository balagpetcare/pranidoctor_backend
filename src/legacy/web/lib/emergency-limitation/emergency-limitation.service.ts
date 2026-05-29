import type { MobileUserSettings } from '@/generated/prisma/client';
import { ServiceRequestType } from '@/generated/prisma/client';

import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { getOrCreateMobileUserSettings } from '../mobile-settings/mobile-settings-store.js';
import { loadEmergencyLimitationConfig } from './emergency-limitation-config.js';
import {
  pickEmergencyLimitationLocaleText,
  type EmergencyLimitationContextKey,
  type EmergencyLimitationLocale,
} from './emergency-limitation-defaults.js';

export type EmergencyLimitationMobileDto = {
  version: string;
  contentVersion: string;
  enforceAcceptance: boolean;
  accepted: boolean;
  acceptedAt: string | null;
  title: string;
  full: { en: string; bn: string };
  banner: { en: string; bn: string };
  urgent: { en: string; bn: string };
  contextual: Record<EmergencyLimitationContextKey, { en: string; bn: string }>;
};

function resolveEmergencyAccepted(
  row: Pick<MobileUserSettings, 'emergencyAcceptedVersion'>,
  version: string,
): boolean {
  return row.emergencyAcceptedVersion != null && row.emergencyAcceptedVersion === version;
}

export async function getEmergencyLimitationForUser(
  userId: string,
): Promise<EmergencyLimitationMobileDto> {
  const [row, legal, limitation] = await Promise.all([
    getOrCreateMobileUserSettings(userId),
    loadLegalConfig(),
    loadEmergencyLimitationConfig(),
  ]);

  return {
    version: legal.emergencyLimitationVersion,
    contentVersion: limitation.contentVersion,
    enforceAcceptance: limitation.enforceAcceptance,
    accepted: resolveEmergencyAccepted(row, legal.emergencyLimitationVersion),
    acceptedAt: row.emergencyAcceptedAt?.toISOString() ?? null,
    title: legal.emergencyLimitationTitle,
    full: limitation.full,
    banner: limitation.banner,
    urgent: limitation.urgent,
    contextual: limitation.contextual,
  };
}

export async function resolveContextLimitationText(
  context: EmergencyLimitationContextKey,
  locale: EmergencyLimitationLocale,
): Promise<string> {
  const limitation = await loadEmergencyLimitationConfig();
  return pickEmergencyLimitationLocaleText(limitation.contextual[context], locale);
}

export async function resolveUrgentLimitationText(
  locale: EmergencyLimitationLocale,
): Promise<string> {
  const limitation = await loadEmergencyLimitationConfig();
  return pickEmergencyLimitationLocaleText(limitation.urgent, locale);
}

export async function resolveBannerLimitationText(
  locale: EmergencyLimitationLocale,
): Promise<string> {
  const limitation = await loadEmergencyLimitationConfig();
  return pickEmergencyLimitationLocaleText(limitation.banner, locale);
}

export function serviceTypeToLimitationContext(
  serviceType: ServiceRequestType,
): EmergencyLimitationContextKey | null {
  switch (serviceType) {
    case ServiceRequestType.EMERGENCY_DOCTOR:
      return 'bookingEmergency';
    case ServiceRequestType.ONLINE_CONSULTATION_LATER:
      return 'bookingOnline';
    default:
      return null;
  }
}

export async function resolveServiceRequestLimitationNotice(
  serviceType: ServiceRequestType,
  locale: EmergencyLimitationLocale = 'bn',
): Promise<string | null> {
  const context = serviceTypeToLimitationContext(serviceType);
  if (!context) return null;
  return resolveContextLimitationText(context, locale);
}

export async function isEmergencyLimitationAcceptanceRequired(
  row: Pick<MobileUserSettings, 'emergencyAcceptedVersion'>,
): Promise<boolean> {
  const [legal, limitation] = await Promise.all([
    loadLegalConfig(),
    loadEmergencyLimitationConfig(),
  ]);
  if (!limitation.enforceAcceptance) return false;
  return !resolveEmergencyAccepted(row, legal.emergencyLimitationVersion);
}

export { pickEmergencyLimitationLocaleText };
