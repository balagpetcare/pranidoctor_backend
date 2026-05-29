import type { MobileUserSettings } from '@/generated/prisma/client';

import { loadLegalConfig, type LegalConfig } from './legal-config.js';

export type MobileLegalConsentStatus = {
  privacyVersion: string;
  termsVersion: string;
  aiConsentVersion: string;
  vetDisclaimerVersion: string;
  emergencyLimitationVersion: string;
  privacyAccepted: boolean;
  termsAccepted: boolean;
  aiConsentAccepted: boolean;
  vetDisclaimerAccepted: boolean;
  emergencyLimitationAccepted: boolean;
  enforcePrivacyConsent: boolean;
  legalGateEnabled: boolean;
  allRequiredAccepted: boolean;
  missing: Array<'privacy' | 'terms' | 'ai' | 'vet' | 'emergency'>;
};

export function resolveLegalConsentStatus(
  row: Pick<
    MobileUserSettings,
    | 'privacyAcceptedVersion'
    | 'termsAcceptedVersion'
    | 'aiAcceptedVersion'
    | 'vetAcceptedVersion'
    | 'emergencyAcceptedVersion'
  >,
  legal: LegalConfig,
): MobileLegalConsentStatus {
  const privacyAccepted =
    row.privacyAcceptedVersion != null && row.privacyAcceptedVersion === legal.privacyVersion;
  const termsAccepted =
    row.termsAcceptedVersion != null && row.termsAcceptedVersion === legal.termsVersion;
  const aiConsentAccepted =
    row.aiAcceptedVersion != null && row.aiAcceptedVersion === legal.aiConsentVersion;
  const vetDisclaimerAccepted =
    row.vetAcceptedVersion != null &&
    row.vetAcceptedVersion === legal.vetDisclaimerVersion;
  const emergencyLimitationAccepted =
    row.emergencyAcceptedVersion != null &&
    row.emergencyAcceptedVersion === legal.emergencyLimitationVersion;

  const missing: MobileLegalConsentStatus['missing'] = [];
  if (!privacyAccepted) missing.push('privacy');
  if (!termsAccepted) missing.push('terms');
  if (!aiConsentAccepted) missing.push('ai');
  if (!vetDisclaimerAccepted) missing.push('vet');
  if (!emergencyLimitationAccepted) missing.push('emergency');

  return {
    privacyVersion: legal.privacyVersion,
    termsVersion: legal.termsVersion,
    aiConsentVersion: legal.aiConsentVersion,
    vetDisclaimerVersion: legal.vetDisclaimerVersion,
    emergencyLimitationVersion: legal.emergencyLimitationVersion,
    privacyAccepted,
    termsAccepted,
    aiConsentAccepted,
    vetDisclaimerAccepted,
    emergencyLimitationAccepted,
    enforcePrivacyConsent: legal.enforcePrivacyConsent,
    legalGateEnabled: legal.legalGateEnabled,
    allRequiredAccepted: privacyAccepted && termsAccepted,
    missing,
  };
}

export function isPrivacyConsentEnforced(legal?: LegalConfig): boolean {
  if (legal) return legal.enforcePrivacyConsent;
  return process.env.MOBILE_ENFORCE_PRIVACY_CONSENT?.trim().toLowerCase() === 'true';
}

/** Paths exempt from privacy gate (normalized, with or without /api prefix). */
export function isPrivacyConsentExemptPath(request: Request): boolean {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  const normalized = pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
  const method = request.method.toUpperCase();

  if (normalized === '/mobile/me' && method === 'GET') return true;
  if (normalized.startsWith('/mobile/settings')) return true;
  if (normalized.startsWith('/mobile/legal')) return true;
  if (normalized.startsWith('/mobile/auth/')) return true;
  if (normalized.startsWith('/mobile/health')) return true;

  return false;
}

export async function getMobileLegalConsentStatusForUser(
  userId: string,
): Promise<MobileLegalConsentStatus> {
  const { getOrCreateMobileUserSettings } = await import('./mobile-settings-store.js');
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return resolveLegalConsentStatus(row, legal);
}
