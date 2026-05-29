import type { LegalConsentType, MobileUserSettings } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';

import { authRequestContext } from '../../../../modules/auth/auth-audit.service.js';
import {
  CONSENT_REGISTRY,
  registryEntryByType,
  type ConsentRegistryEntry,
} from './consent-registry.js';
import { recordLegalConsentEvent } from './legal-consent-audit.js';
import { loadLegalConfig, type LegalConfig } from './legal-config.js';
import { getOrCreateMobileUserSettings } from './mobile-settings-store.js';

export type ConsentRecordDto = {
  type: LegalConsentType;
  key: ConsentRegistryEntry['key'];
  label: string;
  requiredVersion: string;
  accepted: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  hardGate: boolean;
};

export type ConsentStatusDto = {
  registry: Array<{
    type: LegalConsentType;
    key: ConsentRegistryEntry['key'];
    label: string;
    hardGate: boolean;
  }>;
  requiredVersions: {
    privacyVersion: string;
    termsVersion: string;
    aiConsentVersion: string;
  };
  records: ConsentRecordDto[];
  reconsentRequired: ConsentRegistryEntry['key'][];
  enforcePrivacyConsent: boolean;
};

function mapRecord(
  entry: ConsentRegistryEntry,
  row: MobileUserSettings,
  legal: LegalConfig,
): ConsentRecordDto {
  const requiredVersion = legal[entry.versionField];
  const acceptedVersion = row[entry.settingsVersionField];
  const acceptedAt = row[entry.settingsAtField];
  const accepted = acceptedVersion != null && acceptedVersion === requiredVersion;

  return {
    type: entry.type,
    key: entry.key,
    label: entry.label,
    requiredVersion,
    accepted,
    acceptedVersion,
    acceptedAt: acceptedAt?.toISOString() ?? null,
    hardGate: entry.hardGate,
  };
}

export function buildConsentStatus(
  row: MobileUserSettings,
  legal: LegalConfig,
): ConsentStatusDto {
  const records = CONSENT_REGISTRY.map((entry) => mapRecord(entry, row, legal));
  const reconsentRequired = records.filter((r) => !r.accepted).map((r) => r.key);

  return {
    registry: CONSENT_REGISTRY.map((e) => ({
      type: e.type,
      key: e.key,
      label: e.label,
      hardGate: e.hardGate,
    })),
    requiredVersions: {
      privacyVersion: legal.privacyVersion,
      termsVersion: legal.termsVersion,
      aiConsentVersion: legal.aiConsentVersion,
    },
    records,
    reconsentRequired,
    enforcePrivacyConsent: legal.enforcePrivacyConsent,
  };
}

export async function getConsentStatusForUser(userId: string): Promise<ConsentStatusDto> {
  const [row, legal] = await Promise.all([getOrCreateMobileUserSettings(userId), loadLegalConfig()]);
  return buildConsentStatus(row, legal);
}

export async function withdrawConsentForUser(
  userId: string,
  consentType: LegalConsentType,
  request?: Request,
  reason?: string,
): Promise<ConsentStatusDto> {
  const entry = registryEntryByType(consentType);
  const legal = await loadLegalConfig();
  const ctx = request ? authRequestContext(request) : {};
  const now = new Date();

  await prisma.mobileUserSettings.upsert({
    where: { userId },
    create: {
      userId,
      updatedAt: now,
      [entry.settingsVersionField]: null,
      [entry.settingsAtField]: null,
    },
    update: {
      updatedAt: now,
      [entry.settingsVersionField]: null,
      [entry.settingsAtField]: null,
    },
  });

  await recordLegalConsentEvent({
    userId,
    consentType,
    version: legal[entry.versionField],
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: {
      action: 'WITHDRAWN',
      ...(reason ? { reason } : {}),
    },
  });

  const row = await getOrCreateMobileUserSettings(userId);
  return buildConsentStatus(row, legal);
}

export type AdminConsentOverviewDto = {
  requiredVersions: ConsentStatusDto['requiredVersions'];
  enforcePrivacyConsent: boolean;
  acceptanceCounts: {
    privacyAccepted: number;
    termsAccepted: number;
    aiConsentAccepted: number;
    totalCustomers: number;
  };
  recentEventsTotal: number;
};

export async function getAdminConsentOverview(): Promise<AdminConsentOverviewDto> {
  const legal = await loadLegalConfig();

  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER', status: 'ACTIVE' },
    select: {
      mobileUserSettings: {
        select: {
          privacyAcceptedVersion: true,
          termsAcceptedVersion: true,
          aiAcceptedVersion: true,
        },
      },
    },
  });

  let privacyAccepted = 0;
  let termsAccepted = 0;
  let aiConsentAccepted = 0;

  for (const user of customers) {
    const s = user.mobileUserSettings;
    if (s?.privacyAcceptedVersion === legal.privacyVersion) privacyAccepted += 1;
    if (s?.termsAcceptedVersion === legal.termsVersion) termsAccepted += 1;
    if (s?.aiAcceptedVersion === legal.aiConsentVersion) aiConsentAccepted += 1;
  }

  const recentEventsTotal = await prisma.legalConsentEvent.count();

  return {
    requiredVersions: {
      privacyVersion: legal.privacyVersion,
      termsVersion: legal.termsVersion,
      aiConsentVersion: legal.aiConsentVersion,
    },
    enforcePrivacyConsent: legal.enforcePrivacyConsent,
    acceptanceCounts: {
      privacyAccepted,
      termsAccepted,
      aiConsentAccepted,
      totalCustomers: customers.length,
    },
    recentEventsTotal,
  };
}
