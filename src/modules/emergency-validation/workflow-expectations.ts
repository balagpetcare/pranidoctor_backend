import { ServiceRequestEventType } from '../../generated/prisma/index.js';

/** Expected timeline sequence for livestock/pet emergency happy path. */
export const EMERGENCY_HAPPY_PATH_EVENTS: ServiceRequestEventType[] = [
  ServiceRequestEventType.CREATED,
  ServiceRequestEventType.ASSIGNED,
  ServiceRequestEventType.ACCEPTED,
  ServiceRequestEventType.COMPLETED,
];

export const EMERGENCY_REASSIGN_PATH_EVENTS: ServiceRequestEventType[] = [
  ServiceRequestEventType.CREATED,
  ServiceRequestEventType.ASSIGNED,
  ServiceRequestEventType.REASSIGNED,
  ServiceRequestEventType.ACCEPTED,
];

export const EMERGENCY_REJECT_PATH_EVENTS: ServiceRequestEventType[] = [
  ServiceRequestEventType.CREATED,
  ServiceRequestEventType.ASSIGNED,
  ServiceRequestEventType.REJECTED,
];

export const EMERGENCY_CANCEL_PATH_EVENTS: ServiceRequestEventType[] = [
  ServiceRequestEventType.CREATED,
  ServiceRequestEventType.CANCELLED,
];

export const PET_ANIMAL_TYPES = ['DOG', 'CAT'] as const;
export const LIVESTOCK_ANIMAL_TYPES = ['CATTLE', 'GOAT', 'POULTRY', 'BUFFALO'] as const;
