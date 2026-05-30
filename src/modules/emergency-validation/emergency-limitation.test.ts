import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ServiceRequestType } from '../../generated/prisma/client';

import { ForbiddenError } from '../../shared/errors/http.errors.js';

vi.mock('../../legacy/web/lib/mobile-settings/mobile-settings-store.js', () => ({
  getOrCreateMobileUserSettings: vi.fn(),
}));

vi.mock('../../legacy/web/lib/emergency-limitation/emergency-limitation-config.js', () => ({
  loadEmergencyLimitationConfig: vi.fn(),
}));

vi.mock('../../legacy/web/lib/mobile-settings/legal-config.js', () => ({
  loadLegalConfig: vi.fn(),
}));

vi.mock('../../legacy/web/lib/emergency-limitation/emergency-limitation.service.js', () => ({
  isEmergencyLimitationAcceptanceRequired: vi.fn(),
}));

import { getOrCreateMobileUserSettings } from '../../legacy/web/lib/mobile-settings/mobile-settings-store.js';
import { loadEmergencyLimitationConfig } from '../../legacy/web/lib/emergency-limitation/emergency-limitation-config.js';
import { loadLegalConfig } from '../../legacy/web/lib/mobile-settings/legal-config.js';
import { isEmergencyLimitationAcceptanceRequired } from '../../legacy/web/lib/emergency-limitation/emergency-limitation.service.js';
import { assertEmergencyLimitationForEmergencyBooking } from '../emergency-limitation/emergency-limitation-guard.js';

describe('E2E-EM-LEGAL-01 — emergency limitation guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadEmergencyLimitationConfig).mockResolvedValue({
      enforceAcceptance: true,
    } as never);
    vi.mocked(loadLegalConfig).mockResolvedValue({
      emergencyLimitationVersion: 'v1',
    } as never);
    vi.mocked(getOrCreateMobileUserSettings).mockResolvedValue({} as never);
  });

  it('allows non-emergency service types without check', async () => {
    await expect(
      assertEmergencyLimitationForEmergencyBooking('u1', ServiceRequestType.DOCTOR_HOME_VISIT),
    ).resolves.toBeUndefined();
    expect(isEmergencyLimitationAcceptanceRequired).not.toHaveBeenCalled();
  });

  it('throws LEGAL_CONSENT_REQUIRED when acceptance missing', async () => {
    vi.mocked(isEmergencyLimitationAcceptanceRequired).mockResolvedValue(true);

    await expect(
      assertEmergencyLimitationForEmergencyBooking('u1', ServiceRequestType.EMERGENCY_DOCTOR),
    ).rejects.toBeInstanceOf(ForbiddenError);

    try {
      await assertEmergencyLimitationForEmergencyBooking('u1', ServiceRequestType.EMERGENCY_DOCTOR);
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      const err = e as ForbiddenError;
      expect(err.code).toBe('LEGAL_CONSENT_REQUIRED');
    }
  });

  it('passes when acceptance not required', async () => {
    vi.mocked(isEmergencyLimitationAcceptanceRequired).mockResolvedValue(false);
    await expect(
      assertEmergencyLimitationForEmergencyBooking('u1', ServiceRequestType.EMERGENCY_DOCTOR),
    ).resolves.toBeUndefined();
  });
});
