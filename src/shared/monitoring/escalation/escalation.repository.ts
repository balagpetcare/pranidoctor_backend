import {
  ServiceRequestEventType,
  AiEscalationReason,
  AiEscalationStatus,
  AiTechnicianComplaintStatus,
  PaymentStatus,
  RequestPriority,
  ServiceRequestStatus,
  ServiceRequestType,
  SupportMessageAuthorType,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../database/prisma.js';

import {
  doctorConsultBaseFilter,
  emergencyRequestFilter,
  type StaleServiceRequestRow,
} from './escalation.helpers.js';
import {
  aiEscalationMonitoringScope,
  assignedStaleAssignedAtFilter,
  inProgressStalledStartedAtFilter,
  maxRecordAgeFilter,
  serviceRequestMonitoringScope,
  supportTicketMonitoringScope,
  windowSinceFilter,
} from './monitoring-scope.js';

export type EscalationMetricsSnapshot = {
  pendingDoctorRequests: number;
  pendingEmergencyUnassigned: number;
  assignedStaleEmergency: number;
  assignedStaleHigh: number;
  assignedStaleNormal: number;
  inProgressStalledEmergency: number;
  inProgressStalledNormal: number;
  onlineConsultMissedWindow: number;
  supportOpenUnanswered: number;
  supportUrgentOpen: number;
  technicianComplaintsOpen: number;
  aiEscalationBacklog: number;
  aiEmergencySymptomUnreviewed: number;
  billingFailedEmergency: number;
};

export async function countPendingDoctorRequests(): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.PENDING,
    }),
  });
}

export async function countOldestPendingAgeMinutes(): Promise<number> {
  const prisma = getPrisma();
  const oldest = await prisma.serviceRequest.findFirst({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.PENDING,
    }),
    orderBy: { submittedAt: 'asc' },
    select: { submittedAt: true },
  });
  if (!oldest) return 0;
  return Math.round((Date.now() - oldest.submittedAt.getTime()) / 60_000);
}

export async function countPendingEmergencyUnassigned(olderThan: Date): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.PENDING,
      ...emergencyRequestFilter(),
      submittedAt: {
        lt: olderThan,
        ...(maxRecordAgeFilter('submittedAt').submittedAt ?? {}),
      },
    }),
  });
}

type PriorityBand = 'emergency' | 'high' | 'normal';

function assignedStaleWhere(band: PriorityBand, maxAgeMinutes: number) {
  const assignedBefore = assignedStaleAssignedAtFilter(maxAgeMinutes);
  const base = serviceRequestMonitoringScope({
    ...doctorConsultBaseFilter(),
    status: ServiceRequestStatus.ASSIGNED,
    assignedAt: assignedBefore,
  });

  if (band === 'emergency') {
    return { ...base, ...emergencyRequestFilter() };
  }
  if (band === 'high') {
    return {
      ...base,
      priority: RequestPriority.HIGH,
      NOT: emergencyRequestFilter(),
    };
  }
  return {
    ...base,
    priority: { in: [RequestPriority.LOW, RequestPriority.NORMAL] },
    NOT: emergencyRequestFilter(),
  };
}

export async function countAssignedStaleByPriority(
  band: PriorityBand,
  maxAgeMinutes: number,
): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: assignedStaleWhere(band, maxAgeMinutes),
  });
}

export async function findAssignedStaleByPriority(
  band: PriorityBand,
  maxAgeMinutes: number,
  limit = 10,
): Promise<StaleServiceRequestRow[]> {
  const prisma = getPrisma();
  return prisma.serviceRequest.findMany({
    where: assignedStaleWhere(band, maxAgeMinutes),
    select: {
      id: true,
      priority: true,
      serviceType: true,
      assignedAt: true,
      submittedAt: true,
      startedAt: true,
    },
    orderBy: { assignedAt: 'asc' },
    take: limit,
  });
}

function inProgressStalledWhere(band: 'emergency' | 'normal', maxAgeMinutes: number) {
  const startedBefore = inProgressStalledStartedAtFilter(maxAgeMinutes);
  const base = serviceRequestMonitoringScope({
    ...doctorConsultBaseFilter(),
    status: ServiceRequestStatus.IN_PROGRESS,
    startedAt: startedBefore,
  });
  return band === 'emergency'
    ? { ...base, ...emergencyRequestFilter() }
    : { ...base, NOT: emergencyRequestFilter() };
}

export async function countInProgressStalled(
  band: 'emergency' | 'normal',
  maxAgeMinutes: number,
): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: inProgressStalledWhere(band, maxAgeMinutes),
  });
}

export async function findInProgressStalled(
  band: 'emergency' | 'normal',
  maxAgeMinutes: number,
  limit = 10,
): Promise<StaleServiceRequestRow[]> {
  const prisma = getPrisma();
  return prisma.serviceRequest.findMany({
    where: inProgressStalledWhere(band, maxAgeMinutes),
    select: {
      id: true,
      priority: true,
      serviceType: true,
      assignedAt: true,
      submittedAt: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'asc' },
    take: limit,
  });
}

export async function countOnlineConsultMissedWindow(): Promise<number> {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.serviceRequest.count({
    where: serviceRequestMonitoringScope({
      serviceType: ServiceRequestType.ONLINE_CONSULTATION_LATER,
      status: {
        in: [
          ServiceRequestStatus.PENDING,
          ServiceRequestStatus.ASSIGNED,
          ServiceRequestStatus.ACCEPTED,
        ],
      },
      scheduledStart: { lt: now },
    }),
  });
}

export async function findOnlineConsultMissedWindow(limit = 10): Promise<StaleServiceRequestRow[]> {
  const prisma = getPrisma();
  const now = new Date();
  return prisma.serviceRequest.findMany({
    where: serviceRequestMonitoringScope({
      serviceType: ServiceRequestType.ONLINE_CONSULTATION_LATER,
      status: {
        in: [
          ServiceRequestStatus.PENDING,
          ServiceRequestStatus.ASSIGNED,
          ServiceRequestStatus.ACCEPTED,
        ],
      },
      scheduledStart: { lt: now },
    }),
    select: {
      id: true,
      priority: true,
      serviceType: true,
      assignedAt: true,
      submittedAt: true,
      startedAt: true,
    },
    orderBy: { scheduledStart: 'asc' },
    take: limit,
  });
}

export async function countRejectionsSince(since: Date): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.REJECTED,
      updatedAt: windowSinceFilter(since),
    }),
  });
}

export async function countAssignmentsSince(since: Date): Promise<number> {
  const prisma = getPrisma();
  return prisma.serviceRequest.count({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      assignedAt: windowSinceFilter(since),
    }),
  });
}

export async function findRecentEmergencyRejections(
  since: Date,
  limit = 10,
): Promise<StaleServiceRequestRow[]> {
  const prisma = getPrisma();
  return prisma.serviceRequest.findMany({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.REJECTED,
      updatedAt: windowSinceFilter(since),
      ...emergencyRequestFilter(),
    }),
    select: {
      id: true,
      priority: true,
      serviceType: true,
      assignedAt: true,
      submittedAt: true,
      startedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}

export async function countSupportOpenUnanswered(olderThanMinutes: number): Promise<number> {
  const prisma = getPrisma();
  const cutoff =
    olderThanMinutes > 0 ? new Date(Date.now() - olderThanMinutes * 60_000) : new Date(Date.now() + 86_400_000);
  return prisma.supportTicket.count({
    where: supportTicketMonitoringScope({
      status: SupportTicketStatus.OPEN,
      ...(olderThanMinutes > 0 ? { createdAt: { lt: cutoff } } : {}),
      messages: { none: { authorType: SupportMessageAuthorType.SUPPORT } },
    }),
  });
}

export async function countSupportUrgentOpen(olderThanMinutes: number): Promise<number> {
  const prisma = getPrisma();
  const cutoff =
    olderThanMinutes > 0 ? new Date(Date.now() - olderThanMinutes * 60_000) : new Date(Date.now() + 86_400_000);
  return prisma.supportTicket.count({
    where: supportTicketMonitoringScope({
      status: SupportTicketStatus.OPEN,
      priority: SupportTicketPriority.URGENT,
      ...(olderThanMinutes > 0 ? { createdAt: { lt: cutoff } } : {}),
    }),
  });
}

export async function countTechnicianComplaintsOpen(olderThanMinutes: number): Promise<number> {
  const prisma = getPrisma();
  const cutoff =
    olderThanMinutes > 0 ? new Date(Date.now() - olderThanMinutes * 60_000) : new Date(Date.now() + 86_400_000);
  return prisma.aiTechnicianComplaint.count({
    where: {
      status: AiTechnicianComplaintStatus.OPEN,
      ...(olderThanMinutes > 0 ? { createdAt: { lt: cutoff } } : {}),
    },
  });
}

export async function countAiEscalationBacklog(): Promise<number> {
  const prisma = getPrisma();
  return prisma.aiEscalationRecord.count({
    where: aiEscalationMonitoringScope({
      status: { in: [AiEscalationStatus.PENDING_REVIEW, AiEscalationStatus.QUEUED] },
    }),
  });
}

export async function countAiEmergencySymptomUnreviewed(olderThanMinutes: number): Promise<number> {
  const prisma = getPrisma();
  const cutoff =
    olderThanMinutes > 0 ? new Date(Date.now() - olderThanMinutes * 60_000) : new Date(Date.now() + 86_400_000);
  return prisma.aiEscalationRecord.count({
    where: aiEscalationMonitoringScope({
      reason: AiEscalationReason.EMERGENCY_SYMPTOM,
      status: { in: [AiEscalationStatus.PENDING_REVIEW, AiEscalationStatus.QUEUED] },
      ...(olderThanMinutes > 0 ? { flaggedAt: { lt: cutoff } } : {}),
    }),
  });
}

export async function countBillingFailedEmergency(): Promise<number> {
  const prisma = getPrisma();
  return prisma.billingRecord.count({
    where: {
      paymentStatus: PaymentStatus.FAILED,
      serviceRequest: serviceRequestMonitoringScope({
        ...emergencyRequestFilter(),
      }),
    },
  });
}

export async function countCancelledAfterAcceptSince(since: Date): Promise<number> {
  const prisma = getPrisma();
  const cancelled = await prisma.serviceRequest.findMany({
    where: serviceRequestMonitoringScope({
      ...doctorConsultBaseFilter(),
      status: ServiceRequestStatus.CANCELLED,
      cancelledAt: windowSinceFilter(since),
    }),
    select: { id: true },
    take: 200,
  });
  if (cancelled.length === 0) return 0;

  const ids = cancelled.map((r) => r.id);
  const withAccept = await prisma.serviceRequestTimelineEvent.count({
    where: {
      serviceRequestId: { in: ids },
      eventType: ServiceRequestEventType.ACCEPTED,
    },
  });
  return withAccept;
}

export { hoursAgo, minutesAgo } from './escalation.helpers.js';
