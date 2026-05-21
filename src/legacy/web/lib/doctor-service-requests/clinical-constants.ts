import { ServiceRequestStatus } from "../../../../generated/prisma/index.js";

/** Request must be assigned to this doctor and open for clinical documentation. */
export const DOCTOR_CLINICAL_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.IN_PROGRESS,
];

/** Doctor may mark the service request completed from these statuses (same as clinical writes). */
export const DOCTOR_CASE_COMPLETABLE_STATUSES: ServiceRequestStatus[] =
  DOCTOR_CLINICAL_REQUEST_STATUSES;
