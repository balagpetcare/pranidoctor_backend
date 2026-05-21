import {
  ServiceRequestStatus,
  UserRole,
} from '../../../generated/prisma/index.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/http.errors.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import type { DoctorCaseAccess } from '../treatment-workflow.types.js';

const MUTABLE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.IN_PROGRESS,
];

export async function resolveDoctorProfileId(userId: string): Promise<string | null> {
  const row = await getPrisma().doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function assertAssignedDoctorAccess(
  userId: string,
  caseId: string,
): Promise<DoctorCaseAccess> {
  const doctorProfileId = await resolveDoctorProfileId(userId);
  if (!doctorProfileId) {
    return { ok: 'FORBIDDEN' };
  }

  const req = await getPrisma().serviceRequest.findFirst({
    where: { id: caseId, assignedDoctorId: doctorProfileId },
    select: { animalId: true, status: true },
  });

  if (!req) {
    return { ok: 'NOT_FOUND' };
  }

  if (!MUTABLE_REQUEST_STATUSES.includes(req.status)) {
    return { ok: 'INVALID_STATUS', status: req.status };
  }

  return { ok: 'ALLOWED', doctorProfileId, animalId: req.animalId };
}

export function mapAccessError(access: Exclude<DoctorCaseAccess, { ok: 'ALLOWED' }>): never {
  switch (access.ok) {
    case 'NOT_FOUND':
      throw new NotFoundError('CASE_NOT_FOUND', 'Case not found or not assigned to you');
    case 'FORBIDDEN':
      throw new ForbiddenError('DOCTOR_PROFILE_REQUIRED', 'Doctor profile required');
    case 'INVALID_STATUS':
      throw new ForbiddenError('CASE_INVALID_STATUS', `Case status ${access.status} does not allow treatment`);
    default:
      throw new ForbiddenError('ACCESS_DENIED', 'Access denied');
  }
}

export async function appendTreatmentAudit(params: {
  caseId: string;
  actorUserId: string;
  eventType: 'CASE_OPENED' | 'CASE_UPDATED' | 'COMPLETED';
  metadata?: Record<string, unknown>;
  note?: string;
}): Promise<void> {
  const { appendTimelineEvent } = await import('../../timeline/timeline.service.js');
  await appendTimelineEvent({
    serviceRequestId: params.caseId,
    eventType: params.eventType,
    actorUserId: params.actorUserId,
    actorRole: UserRole.DOCTOR,
    ...(params.note ? { note: params.note } : {}),
    ...(params.metadata ? { metadata: params.metadata } : {}),
  });
}
