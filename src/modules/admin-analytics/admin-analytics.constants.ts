import {
  BillingStatus,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../generated/prisma/index.js';

/** Doctor consultation service types (excludes AI-only). */
export const CONSULTATION_SERVICE_TYPES: ServiceRequestType[] = [
  ServiceRequestType.DOCTOR_HOME_VISIT,
  ServiceRequestType.EMERGENCY_DOCTOR,
  ServiceRequestType.ONLINE_CONSULTATION_LATER,
];

export const REVENUE_BILLING_STATUSES: BillingStatus[] = [
  BillingStatus.ISSUED,
  BillingStatus.PARTIALLY_PAID,
  BillingStatus.PAID,
];

export const PENDING_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.PENDING,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.IN_PROGRESS,
];

export const DEFAULT_ACTIVE_USER_DAYS = 30;
export const MAX_ANALYTICS_RANGE_DAYS = 366;
export const CACHE_TTL_MS = 5 * 60 * 1000;

export const ANIMAL_TYPE_COW = ['CATTLE'] as const;
export const ANIMAL_TYPE_GOAT = ['GOAT'] as const;
export const ANIMAL_TYPE_POULTRY = ['POULTRY'] as const;
export const ANIMAL_TYPE_PET = ['DOG', 'CAT'] as const;
