import {
  RequestPriority,
  ServiceRequestEventType,
  ServiceRequestStatus,
  ServiceRequestType,
  UserRole,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { appendTimelineEvent } from '../timeline/timeline.service.js';

import {
  CUSTOMER_CANCELLABLE_STATUSES,
  SERVICE_TYPE_EXPECTED_CATEGORY_SLUG,
  serviceRequestInclude,
  toServiceRequestDto,
} from './service-request.mapper.js';

export type CreateServiceRequestBody = {
  animalId: string;
  serviceCategoryId: string;
  serviceType: ServiceRequestType;
  problemOrSymptom: string;
  description?: string | null;
  areaId?: string | null;
  villageId?: string | null;
  locationText?: string | null;
  preferredTime?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
};

export async function createServiceRequestForCustomer(
  customerProfileId: string,
  body: CreateServiceRequestBody,
) {
  const prisma = getPrisma();
  const expectedSlug = SERVICE_TYPE_EXPECTED_CATEGORY_SLUG[body.serviceType];

  const [animal, category, area, village] = await Promise.all([
    prisma.animalProfile.findFirst({
      where: {
        id: body.animalId,
        customerId: customerProfileId,
        active: true,
      },
    }),
    prisma.serviceCategory.findUnique({
      where: { id: body.serviceCategoryId },
    }),
    body.areaId ? prisma.area.findUnique({ where: { id: body.areaId } }) : null,
    body.villageId ? prisma.village.findUnique({ where: { id: body.villageId } }) : null,
  ]);

  if (!animal) {
    return { ok: 'NOT_FOUND_ANIMAL' as const };
  }
  if (!category) {
    return { ok: 'NOT_FOUND_CATEGORY' as const };
  }
  if (category.slug !== expectedSlug) {
    return { ok: 'CATEGORY_TYPE_MISMATCH' as const, expectedSlug };
  }
  if (body.areaId && !area) {
    return { ok: 'NOT_FOUND_AREA' as const };
  }
  if (body.villageId && !village) {
    return { ok: 'NOT_FOUND_VILLAGE' as const };
  }

  const isEmergency = body.serviceType === ServiceRequestType.EMERGENCY_DOCTOR;
  const scheduledStart =
    body.scheduledStart != null && body.scheduledStart !== ''
      ? new Date(body.scheduledStart)
      : null;
  const scheduledEnd =
    body.scheduledEnd != null && body.scheduledEnd !== ''
      ? new Date(body.scheduledEnd)
      : null;

  const row = await prisma.serviceRequest.create({
    data: {
      customerId: customerProfileId,
      animalId: body.animalId,
      serviceCategoryId: body.serviceCategoryId,
      serviceType: body.serviceType,
      problemOrSymptom: body.problemOrSymptom.trim(),
      description: body.description?.trim() || null,
      areaId: body.areaId?.trim() || null,
      villageId: body.villageId?.trim() || null,
      locationText: body.locationText?.trim() || null,
      preferredTime: body.preferredTime?.trim() || null,
      ...(scheduledStart ? { scheduledStart } : {}),
      ...(scheduledEnd ? { scheduledEnd } : {}),
      status: ServiceRequestStatus.PENDING,
      isEmergency,
      priority: isEmergency ? RequestPriority.EMERGENCY : RequestPriority.NORMAL,
    },
    include: serviceRequestInclude,
  });

  await appendTimelineEvent({
    serviceRequestId: row.id,
    eventType: ServiceRequestEventType.CREATED,
    actorRole: UserRole.CUSTOMER,
    note: body.problemOrSymptom.trim(),
  });

  return { ok: 'CREATED' as const, request: toServiceRequestDto(row) };
}

export async function listServiceRequestsForCustomer(
  customerProfileId: string,
  opts: {
    status?: ServiceRequestStatus;
    limit: number;
    offset: number;
  },
) {
  const prisma = getPrisma();
  const where = {
    customerId: customerProfileId,
    ...(opts.status ? { status: opts.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: opts.limit,
      skip: opts.offset,
      include: serviceRequestInclude,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return {
    requests: rows.map(toServiceRequestDto),
    total,
  };
}

export async function getServiceRequestForCustomer(
  customerProfileId: string,
  requestId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId: customerProfileId },
    include: serviceRequestInclude,
  });
  return row ? toServiceRequestDto(row) : null;
}

export async function cancelServiceRequestForCustomer(
  customerProfileId: string,
  requestId: string,
  cancelReason: string | null | undefined,
) {
  const prisma = getPrisma();
  const existing = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId: customerProfileId },
  });

  if (!existing) {
    return { ok: 'NOT_FOUND' as const };
  }

  if (
    existing.status === ServiceRequestStatus.COMPLETED ||
    existing.status === ServiceRequestStatus.CANCELLED
  ) {
    return { ok: 'NOT_CANCELLABLE' as const, status: existing.status };
  }

  if (!CUSTOMER_CANCELLABLE_STATUSES.includes(existing.status)) {
    return { ok: 'NOT_CANCELLABLE' as const, status: existing.status };
  }

  const row = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status: ServiceRequestStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: cancelReason?.trim() || null,
    },
    include: serviceRequestInclude,
  });

  await appendTimelineEvent({
    serviceRequestId: requestId,
    eventType: ServiceRequestEventType.CANCELLED,
    actorRole: UserRole.CUSTOMER,
    note: cancelReason?.trim() || null,
  });

  return { ok: 'CANCELLED' as const, request: toServiceRequestDto(row) };
}
