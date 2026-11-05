import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import { adminListPrescriptionsForServiceRequest } from "@/lib/admin-prescriptions/prescription-admin.service";
import type { DoctorPrescriptionSummaryDto } from "@/lib/doctor-service-requests/doctor-clinical-service";

import type { AdminListServiceRequestsQuery } from "./schemas";
import { toServiceRequestDto } from "@/lib/mobile-service-requests/service-request-mapper";

const adminInclude = {
  serviceCategory: { select: { id: true, name: true, slug: true } },
  animal: {
    select: {
      id: true,
      name: true,
      species: true,
      active: true,
      animalType: true,
    },
  },
  assignedDoctor: { select: { id: true, displayName: true } },
  assignedTechnician: { select: { id: true, displayName: true } },
  customer: {
    select: {
      id: true,
      displayName: true,
      userId: true,
      user: {
        select: {
          email: true,
          phone: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceRequestInclude;

export type ServiceRequestAdminRow = Prisma.ServiceRequestGetPayload<{
  include: typeof adminInclude;
}>;

function toAdminDto(row: ServiceRequestAdminRow) {
  const { customer, ...rest } = row;
  return {
    ...toServiceRequestDto(rest),
    customer,
  };
}

export async function adminListServiceRequests(
  query: AdminListServiceRequestsQuery,
) {
  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const where: Prisma.ServiceRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.areaId ? { areaId: query.areaId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      include: adminInclude,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return {
    requests: rows.map(toAdminDto),
    total,
    limit,
    offset,
  };
}

export async function adminGetServiceRequest(requestId: string) {
  const row = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: adminInclude,
  });
  if (!row) return null;

  const prescriptions = await adminListPrescriptionsForServiceRequest(requestId);

  return {
    ...toAdminDto(row),
    prescriptions,
  };
}

export type AdminServiceRequestDto = NonNullable<
  Awaited<ReturnType<typeof adminGetServiceRequest>>
> & {
  prescriptions: DoctorPrescriptionSummaryDto[];
};
