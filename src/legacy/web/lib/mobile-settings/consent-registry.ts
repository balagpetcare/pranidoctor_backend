import type { LegalConsentType } from '@/generated/prisma/client';

/** Canonical consent registry — version keys map to `LegalConfig` fields. */
export type ConsentRegistryEntry = {
  type: LegalConsentType;
  /** Mobile / API alias used in client re-consent flows. */
  key: 'privacy' | 'terms' | 'ai' | 'vet' | 'emergency';
  label: string;
  versionField: 'privacyVersion' | 'termsVersion' | 'aiConsentVersion'     | 'vetDisclaimerVersion'
    | 'emergencyLimitationVersion';
  settingsVersionField:
    | 'privacyAcceptedVersion'
    | 'termsAcceptedVersion'
    | 'aiAcceptedVersion'
    | 'vetAcceptedVersion'
    | 'emergencyAcceptedVersion';
  settingsAtField:
    | 'privacyAcceptedAt'
    | 'termsAcceptedAt'
    | 'aiAcceptedAt'
    | 'vetAcceptedAt'
    | 'emergencyAcceptedAt';
  /** Hard gate blocks protected APIs when stale (privacy only today). */
  hardGate: boolean;
};

export const CONSENT_REGISTRY: readonly ConsentRegistryEntry[] = [
  {
    type: 'PRIVACY',
    key: 'privacy',
    label: 'Privacy Policy',
    versionField: 'privacyVersion',
    settingsVersionField: 'privacyAcceptedVersion',
    settingsAtField: 'privacyAcceptedAt',
    hardGate: true,
  },
  {
    type: 'TERMS',
    key: 'terms',
    label: 'Terms of Service',
    versionField: 'termsVersion',
    settingsVersionField: 'termsAcceptedVersion',
    settingsAtField: 'termsAcceptedAt',
    hardGate: false,
  },
  {
    type: 'AI_PROCESSING',
    key: 'ai',
    label: 'AI Processing',
    versionField: 'aiConsentVersion',
    settingsVersionField: 'aiAcceptedVersion',
    settingsAtField: 'aiAcceptedAt',
    hardGate: false,
  },
  {
    type: 'VET_ADVICE',
    key: 'vet',
    label: 'Veterinary Advice Disclaimer',
    versionField: 'vetDisclaimerVersion',
    settingsVersionField: 'vetAcceptedVersion',
    settingsAtField: 'vetAcceptedAt',
    hardGate: false,
  },
  {
    type: 'EMERGENCY_SERVICE',
    key: 'emergency',
    label: 'Emergency Service Limitation Notice',
    versionField: 'emergencyLimitationVersion',
    settingsVersionField: 'emergencyAcceptedVersion',
    settingsAtField: 'emergencyAcceptedAt',
    hardGate: false,
  },
] as const;

export function registryEntryByType(type: LegalConsentType): ConsentRegistryEntry {
  const entry = CONSENT_REGISTRY.find((e) => e.type === type);
  if (!entry) throw new Error(`Unknown consent type: ${type}`);
  return entry;
}

export function registryEntryByKey(key: ConsentRegistryEntry['key']): ConsentRegistryEntry {
  const entry = CONSENT_REGISTRY.find((e) => e.key === key);
  if (!entry) throw new Error(`Unknown consent key: ${key}`);
  return entry;
}
