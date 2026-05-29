import type { MobileUserSettings } from '@/generated/prisma/client';
import { ServiceRequestType } from '@/generated/prisma/client';

import { loadLegalConfig } from '../mobile-settings/legal-config.js';
import { getOrCreateMobileUserSettings } from '../mobile-settings/mobile-settings-store.js';
import { loadVetDisclaimerConfig } from './vet-disclaimer-config.js';
import {
  pickVetDisclaimerLocaleText,
  type VetDisclaimerContextKey,
  type VetDisclaimerLocale,
} from './vet-disclaimer-defaults.js';

export type VetDisclaimerMobileDto = {
  version: string;
  contentVersion: string;
  enforceAcceptance: boolean;
  accepted: boolean;
  acceptedAt: string | null;
  title: string;
  full: { en: string; bn: string };
  banner: { en: string; bn: string };
  emergency: { en: string; bn: string };
  contextual: Record<VetDisclaimerContextKey, { en: string; bn: string }>;
};

function resolveVetAccepted(
  row: Pick<MobileUserSettings, 'vetAcceptedVersion'>,
  version: string,
): boolean {
  return row.vetAcceptedVersion != null && row.vetAcceptedVersion === version;
}

export async function getVetDisclaimerForUser(userId: string): Promise<VetDisclaimerMobileDto> {
  const [row, legal, disclaimer] = await Promise.all([
    getOrCreateMobileUserSettings(userId),
    loadLegalConfig(),
    loadVetDisclaimerConfig(),
  ]);

  return {
    version: legal.vetDisclaimerVersion,
    contentVersion: disclaimer.contentVersion,
    enforceAcceptance: disclaimer.enforceAcceptance,
    accepted: resolveVetAccepted(row, legal.vetDisclaimerVersion),
    acceptedAt: row.vetAcceptedAt?.toISOString() ?? null,
    title: legal.vetDisclaimerTitle,
    full: disclaimer.full,
    banner: disclaimer.banner,
    emergency: disclaimer.emergency,
    contextual: disclaimer.contextual,
  };
}

export async function resolveContextDisclaimerText(
  context: VetDisclaimerContextKey,
  locale: VetDisclaimerLocale,
): Promise<string> {
  const disclaimer = await loadVetDisclaimerConfig();
  return pickVetDisclaimerLocaleText(disclaimer.contextual[context], locale);
}

export async function resolveEmergencyDisclaimerText(
  locale: VetDisclaimerLocale,
): Promise<string> {
  const disclaimer = await loadVetDisclaimerConfig();
  return pickVetDisclaimerLocaleText(disclaimer.emergency, locale);
}

export async function resolveBannerVetDisclaimerText(
  locale: VetDisclaimerLocale,
): Promise<string> {
  const disclaimer = await loadVetDisclaimerConfig();
  return pickVetDisclaimerLocaleText(disclaimer.banner, locale);
}

export function serviceTypeToDisclaimerContext(
  serviceType: ServiceRequestType,
): VetDisclaimerContextKey | null {
  switch (serviceType) {
    case ServiceRequestType.DOCTOR_HOME_VISIT:
      return 'bookingHome';
    case ServiceRequestType.EMERGENCY_DOCTOR:
      return 'bookingEmergency';
    case ServiceRequestType.ONLINE_CONSULTATION_LATER:
      return 'bookingOnline';
    default:
      return null;
  }
}

export async function resolveServiceRequestDisclaimer(
  serviceType: ServiceRequestType,
  locale: VetDisclaimerLocale = 'bn',
): Promise<string | null> {
  const context = serviceTypeToDisclaimerContext(serviceType);
  if (!context) return null;
  return resolveContextDisclaimerText(context, locale);
}

export async function isVetDisclaimerAcceptanceRequired(
  row: Pick<MobileUserSettings, 'vetAcceptedVersion'>,
): Promise<boolean> {
  const [legal, disclaimer] = await Promise.all([loadLegalConfig(), loadVetDisclaimerConfig()]);
  if (!disclaimer.enforceAcceptance) return false;
  return !resolveVetAccepted(row, legal.vetDisclaimerVersion);
}

export { pickVetDisclaimerLocaleText };
