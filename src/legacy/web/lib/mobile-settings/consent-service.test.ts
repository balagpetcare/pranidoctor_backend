import { describe, expect, it } from 'vitest';

import { buildConsentStatus } from './consent-service.js';
import { DEFAULT_LEGAL } from './legal-defaults.js';

describe('buildConsentStatus', () => {
  const row = {
    userId: 'u1',
    theme: 'SYSTEM' as const,
    locale: 'bn-BD',
    privacyAcceptedVersion: '2026-05-30',
    privacyAcceptedAt: new Date('2026-05-30T10:00:00Z'),
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    aiAcceptedVersion: null,
    aiAcceptedAt: null,
    updatedAt: new Date(),
  };

  const legal = {
    ...DEFAULT_LEGAL,
    privacyVersion: '2026-05-30',
    termsVersion: '2026-05-30',
    aiConsentVersion: '2026-05-30',
    enforcePrivacyConsent: true,
  };

  it('marks accepted privacy and lists reconsent for terms and ai', () => {
    const status = buildConsentStatus(row, legal);
    const privacy = status.records.find((r) => r.key === 'privacy');
    expect(privacy?.accepted).toBe(true);
    expect(status.reconsentRequired).toEqual(['terms', 'ai', 'vet', 'emergency']);
    expect(status.enforcePrivacyConsent).toBe(true);
  });

  it('flags all types when versions are stale', () => {
    const status = buildConsentStatus(
      { ...row, privacyAcceptedVersion: '2026-05-01' },
      DEFAULT_LEGAL,
    );
    expect(status.reconsentRequired).toContain('privacy');
  });
});
