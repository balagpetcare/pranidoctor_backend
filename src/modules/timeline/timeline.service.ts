import type { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import type {
  AppendTimelineInput,
  ServiceRequestTimelineDto,
  TimelineEventDto,
} from './timeline.types.js';

function mapEvent(row: {
  id: string;
  eventType: TimelineEventDto['eventType'];
  actorUserId: string | null;
  actorRole: TimelineEventDto['actorRole'];
  note: string | null;
  metadataJson: Prisma.JsonValue;
  createdAt: Date;
}): TimelineEventDto {
  const metadata =
    row.metadataJson != null &&
    typeof row.metadataJson === 'object' &&
    !Array.isArray(row.metadataJson)
      ? (row.metadataJson as Record<string, unknown>)
      : null;

  return {
    id: row.id,
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    actorDisplayName: null,
    note: row.note,
    metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function appendTimelineEvent(input: AppendTimelineInput): Promise<TimelineEventDto> {
  const prisma = getPrisma();
  const row = await prisma.serviceRequestTimelineEvent.create({
    data: {
      serviceRequestId: input.serviceRequestId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      note: input.note?.trim() || null,
      ...(input.metadata != null
        ? { metadataJson: input.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
  return mapEvent(row);
}

export async function listTimelineForServiceRequest(
  serviceRequestId: string,
): Promise<ServiceRequestTimelineDto> {
  const prisma = getPrisma();
  const rows = await prisma.serviceRequestTimelineEvent.findMany({
    where: { serviceRequestId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return {
    requestId: serviceRequestId,
    events: rows.map(mapEvent),
  };
}

export async function serviceRequestExists(serviceRequestId: string): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function customerOwnsServiceRequest(
  customerProfileId: string,
  serviceRequestId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, customerId: customerProfileId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function doctorAssignedToServiceRequest(
  doctorProfileId: string,
  serviceRequestId: string,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, assignedDoctorId: doctorProfileId },
    select: { id: true },
  });
  return Boolean(row);
}
