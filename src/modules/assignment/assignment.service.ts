import {
  ProviderStatus,
  ServiceRequestEventType,
  ServiceRequestStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { appendTimelineEvent } from '../timeline/timeline.service.js';

const TERMINAL: ServiceRequestStatus[] = [
  ServiceRequestStatus.COMPLETED,
  ServiceRequestStatus.CANCELLED,
  ServiceRequestStatus.REJECTED,
];

const DOCTOR_REJECT_REASON_PREFIX = 'Doctor rejected:';

async function assertAssignableDoctor(doctorProfileId: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.doctorProfile.findFirst({
    where: {
      id: doctorProfileId,
      providerStatus: ProviderStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function assertAssignableTechnician(technicianProfileId: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.aiTechnicianProfile.findFirst({
    where: {
      id: technicianProfileId,
      providerStatus: ProviderStatus.ACTIVE,
      user: { status: UserStatus.ACTIVE },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export type AssignDoctorResult =
  | { ok: 'UPDATED' }
  | { ok: 'NOT_FOUND' }
  | { ok: 'INVALID_DOCTOR' }
  | { ok: 'TERMINAL_STATUS'; status: ServiceRequestStatus }
  | { ok: 'INVALID_TRANSITION'; status: ServiceRequestStatus };

export async function assignDoctorToServiceRequest(
  serviceRequestId: string,
  doctorProfileId: string,
): Promise<AssignDoctorResult> {
  const prisma = getPrisma();
  const doctorOk = await assertAssignableDoctor(doctorProfileId);
  if (!doctorOk) {
    return { ok: 'INVALID_DOCTOR' };
  }

  const req = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: {
      id: true,
      status: true,
      assignedDoctorId: true,
    },
  });

  if (!req) {
    return { ok: 'NOT_FOUND' };
  }

  if (TERMINAL.includes(req.status)) {
    return { ok: 'TERMINAL_STATUS', status: req.status };
  }

  if (
    req.status === ServiceRequestStatus.ACCEPTED ||
    req.status === ServiceRequestStatus.IN_PROGRESS
  ) {
    if (req.assignedDoctorId !== doctorProfileId) {
      return { ok: 'INVALID_TRANSITION', status: req.status };
    }
    return { ok: 'UPDATED' };
  }

  if (
    req.status !== ServiceRequestStatus.PENDING &&
    req.status !== ServiceRequestStatus.ASSIGNED
  ) {
    return { ok: 'INVALID_TRANSITION', status: req.status };
  }

  const isReassign =
    req.assignedDoctorId != null && req.assignedDoctorId !== doctorProfileId;

  await prisma.serviceRequest.update({
    where: { id: serviceRequestId },
    data: {
      assignedDoctorId: doctorProfileId,
      status: ServiceRequestStatus.ASSIGNED,
      assignedAt: new Date(),
    },
  });

  await appendTimelineEvent({
    serviceRequestId,
    eventType: isReassign
      ? ServiceRequestEventType.REASSIGNED
      : ServiceRequestEventType.ASSIGNED,
    actorRole: UserRole.ADMIN,
    metadata: { doctorProfileId },
  });

  return { ok: 'UPDATED' };
}

export type AssignTechnicianResult =
  | { ok: 'UPDATED' }
  | { ok: 'NOT_FOUND' }
  | { ok: 'INVALID_TECHNICIAN' }
  | { ok: 'TERMINAL_STATUS'; status: ServiceRequestStatus }
  | { ok: 'INVALID_TRANSITION'; status: ServiceRequestStatus };

export async function assignTechnicianToServiceRequest(
  serviceRequestId: string,
  technicianProfileId: string,
): Promise<AssignTechnicianResult> {
  const prisma = getPrisma();
  const techOk = await assertAssignableTechnician(technicianProfileId);
  if (!techOk) {
    return { ok: 'INVALID_TECHNICIAN' };
  }

  const req = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: {
      id: true,
      status: true,
      assignedTechnicianId: true,
    },
  });

  if (!req) {
    return { ok: 'NOT_FOUND' };
  }

  if (TERMINAL.includes(req.status)) {
    return { ok: 'TERMINAL_STATUS', status: req.status };
  }

  if (
    req.status === ServiceRequestStatus.ACCEPTED ||
    req.status === ServiceRequestStatus.IN_PROGRESS
  ) {
    if (req.assignedTechnicianId === technicianProfileId) {
      return { ok: 'UPDATED' };
    }
    if (req.assignedTechnicianId == null) {
      await prisma.serviceRequest.update({
        where: { id: serviceRequestId },
        data: {
          assignedTechnicianId: technicianProfileId,
          assignedAt: new Date(),
        },
      });
      await appendTimelineEvent({
        serviceRequestId,
        eventType: ServiceRequestEventType.ASSIGNED,
        actorRole: UserRole.ADMIN,
        metadata: { technicianProfileId },
      });
      return { ok: 'UPDATED' };
    }
    return { ok: 'INVALID_TRANSITION', status: req.status };
  }

  if (
    req.status !== ServiceRequestStatus.PENDING &&
    req.status !== ServiceRequestStatus.ASSIGNED
  ) {
    return { ok: 'INVALID_TRANSITION', status: req.status };
  }

  const isReassign =
    req.assignedTechnicianId != null &&
    req.assignedTechnicianId !== technicianProfileId;

  await prisma.serviceRequest.update({
    where: { id: serviceRequestId },
    data: {
      assignedTechnicianId: technicianProfileId,
      status: ServiceRequestStatus.ASSIGNED,
      assignedAt: new Date(),
    },
  });

  await appendTimelineEvent({
    serviceRequestId,
    eventType: isReassign
      ? ServiceRequestEventType.REASSIGNED
      : ServiceRequestEventType.ASSIGNED,
    actorRole: UserRole.ADMIN,
    metadata: { technicianProfileId },
  });

  return { ok: 'UPDATED' };
}

export type AcceptForDoctorResult =
  | { ok: 'ACCEPTED' }
  | { ok: 'ALREADY_ACCEPTED' }
  | { ok: 'NOT_FOUND' }
  | { ok: 'INVALID_STATUS'; status: ServiceRequestStatus };

export async function acceptServiceRequestForDoctor(
  doctorProfileId: string,
  requestId: string,
): Promise<AcceptForDoctorResult> {
  const prisma = getPrisma();
  const updated = await prisma.serviceRequest.updateMany({
    where: {
      id: requestId,
      assignedDoctorId: doctorProfileId,
      status: ServiceRequestStatus.ASSIGNED,
    },
    data: { status: ServiceRequestStatus.ACCEPTED },
  });

  if (updated.count > 0) {
    await appendTimelineEvent({
      serviceRequestId: requestId,
      eventType: ServiceRequestEventType.ACCEPTED,
      actorRole: UserRole.DOCTOR,
      metadata: { doctorProfileId },
    });
    return { ok: 'ACCEPTED' };
  }

  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    select: { status: true },
  });

  if (!row) {
    return { ok: 'NOT_FOUND' };
  }

  if (row.status === ServiceRequestStatus.ACCEPTED) {
    return { ok: 'ALREADY_ACCEPTED' };
  }

  return { ok: 'INVALID_STATUS', status: row.status };
}

export type RejectForDoctorResult =
  | { ok: 'REJECTED' }
  | { ok: 'ALREADY_REJECTED' }
  | { ok: 'NOT_FOUND' }
  | { ok: 'INVALID_STATUS'; status: ServiceRequestStatus };

export async function rejectServiceRequestForDoctor(
  doctorProfileId: string,
  requestId: string,
  reason: string | undefined,
): Promise<RejectForDoctorResult> {
  const prisma = getPrisma();
  const cancelReason = reason
    ? `${DOCTOR_REJECT_REASON_PREFIX} ${reason}`
    : DOCTOR_REJECT_REASON_PREFIX;

  const updated = await prisma.serviceRequest.updateMany({
    where: {
      id: requestId,
      assignedDoctorId: doctorProfileId,
      status: {
        in: [ServiceRequestStatus.ASSIGNED, ServiceRequestStatus.ACCEPTED],
      },
    },
    data: {
      status: ServiceRequestStatus.REJECTED,
      cancelReason,
    },
  });

  if (updated.count > 0) {
    await appendTimelineEvent({
      serviceRequestId: requestId,
      eventType: ServiceRequestEventType.REJECTED,
      actorRole: UserRole.DOCTOR,
      note: reason?.trim() || null,
    });
    return { ok: 'REJECTED' };
  }

  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    select: { status: true },
  });

  if (!row) {
    return { ok: 'NOT_FOUND' };
  }

  if (row.status === ServiceRequestStatus.REJECTED) {
    return { ok: 'ALREADY_REJECTED' };
  }

  return { ok: 'INVALID_STATUS', status: row.status };
}

export async function recordServiceRequestCompleted(
  serviceRequestId: string,
  doctorProfileId: string,
): Promise<void> {
  await appendTimelineEvent({
    serviceRequestId,
    eventType: ServiceRequestEventType.COMPLETED,
    actorRole: UserRole.DOCTOR,
    metadata: { doctorProfileId },
  });
}
