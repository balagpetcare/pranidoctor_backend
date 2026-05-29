import { ServiceRequestType } from '@/generated/prisma/client';

import { loadEmergencyLimitationConfig } from '../../legacy/web/lib/emergency-limitation/emergency-limitation-config.js';
import { getOrCreateMobileUserSettings } from '../../legacy/web/lib/mobile-settings/mobile-settings-store.js';
import { loadLegalConfig } from '../../legacy/web/lib/mobile-settings/legal-config.js';
import { isEmergencyLimitationAcceptanceRequired } from '../../legacy/web/lib/emergency-limitation/emergency-limitation.service.js';
import { ForbiddenError } from '../../shared/errors/http.errors.js';

export async function assertEmergencyLimitationForEmergencyBooking(
  userId: string,
  serviceType: ServiceRequestType,
): Promise<void> {
  if (serviceType !== ServiceRequestType.EMERGENCY_DOCTOR) return;

  const [row, limitation, legal] = await Promise.all([
    getOrCreateMobileUserSettings(userId),
    loadEmergencyLimitationConfig(),
    loadLegalConfig(),
  ]);

  if (!limitation.enforceAcceptance) return;

  const required = await isEmergencyLimitationAcceptanceRequired(row);
  if (!required) return;

  throw new ForbiddenError(
    'LEGAL_CONSENT_REQUIRED',
    'Emergency service limitation acceptance required for emergency booking',
    {
      missing: ['emergency'],
      emergencyLimitationVersion: legal.emergencyLimitationVersion,
      enforceAcceptance: limitation.enforceAcceptance,
      serviceType,
    },
  );
}
