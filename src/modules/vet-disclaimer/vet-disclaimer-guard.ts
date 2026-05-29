import { ServiceRequestType } from '@/generated/prisma/client';

import { loadVetDisclaimerConfig } from '../../legacy/web/lib/vet-disclaimer/vet-disclaimer-config.js';
import { getOrCreateMobileUserSettings } from '../../legacy/web/lib/mobile-settings/mobile-settings-store.js';
import { loadLegalConfig } from '../../legacy/web/lib/mobile-settings/legal-config.js';
import { isVetDisclaimerAcceptanceRequired } from '../../legacy/web/lib/vet-disclaimer/vet-disclaimer.service.js';
import { ForbiddenError } from '../../shared/errors/http.errors.js';

const DOCTOR_CONSULTATION_TYPES = new Set<ServiceRequestType>([
  ServiceRequestType.DOCTOR_HOME_VISIT,
  ServiceRequestType.EMERGENCY_DOCTOR,
  ServiceRequestType.ONLINE_CONSULTATION_LATER,
]);

export function isDoctorConsultationServiceType(serviceType: ServiceRequestType): boolean {
  return DOCTOR_CONSULTATION_TYPES.has(serviceType);
}

export async function assertVetDisclaimerForConsultationBooking(
  userId: string,
  serviceType: ServiceRequestType,
): Promise<void> {
  if (!isDoctorConsultationServiceType(serviceType)) return;

  const [row, disclaimer, legal] = await Promise.all([
    getOrCreateMobileUserSettings(userId),
    loadVetDisclaimerConfig(),
    loadLegalConfig(),
  ]);

  if (!disclaimer.enforceAcceptance) return;

  const required = await isVetDisclaimerAcceptanceRequired(row);
  if (!required) return;

  throw new ForbiddenError(
    'LEGAL_CONSENT_REQUIRED',
    'Veterinary disclaimer acceptance required for consultation booking',
    {
      missing: ['vet'],
      vetDisclaimerVersion: legal.vetDisclaimerVersion,
      enforceAcceptance: disclaimer.enforceAcceptance,
      serviceType,
    },
  );
}
