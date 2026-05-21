import type { Prisma } from "@/generated/prisma/client";
import type { ServiceRequestWithRelations } from "@/lib/mobile-service-requests/service-request-mapper";
import {
  serviceRequestInclude,
  toServiceRequestDto,
} from "@/lib/mobile-service-requests/service-request-mapper";
import { prisma } from "@/lib/prisma";

import { doctorServiceRequestDetailInclude } from "@/lib/doctor-service-requests/doctor-detail-include";
import {
  statusesForTechnicianListTab,
  type TechnicianListServiceRequestsQuery,
} from "./schemas";

export type TechnicianServiceRequestDetailRow = Prisma.ServiceRequestGetPayload<{
  include: typeof doctorServiceRequestDetailInclude;
}>;

export type TechnicianServiceRequestDetailDto = ReturnType<
  typeof toTechnicianServiceRequestDetailDto
>;

function narrowAnimalForServiceDto(
  animal: TechnicianServiceRequestDetailRow["animal"],
): ServiceRequestWithRelations["animal"] {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    active: animal.active,
    animalType: animal.animalType,
  };
}

function toTechnicianAnimalDetailDto(
  animal: TechnicianServiceRequestDetailRow["animal"],
) {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    active: animal.active,
    animalType: animal.animalType,
    breed: animal.breed,
    weightKg: animal.weightKg != null ? String(animal.weightKg) : null,
    notes: animal.notes,
  };
}

function toTechnicianServiceRequestDetailDto(row: TechnicianServiceRequestDetailRow) {
  const { customer, animal, ...rest } = row;
  const base = toServiceRequestDto({
    ...rest,
    animal: narrowAnimalForServiceDto(animal),
  } as ServiceRequestWithRelations);

  return {
    ...base,
    animal: toTechnicianAnimalDetailDto(animal),
    customer: {
      id: customer.id,
      displayName: customer.displayName,
    },
  };
}

export async function listServiceRequestsForTechnician(
  technicianProfileId: string,
  query: TechnicianListServiceRequestsQuery,
) {
  const statuses = statusesForTechnicianListTab(query.tab);
  const where = {
    assignedTechnicianId: technicianProfileId,
    status: { in: statuses },
  };

  const [rows, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: query.limit,
      skip: query.offset,
      include: serviceRequestInclude,
    }),
    prisma.serviceRequest.count({ where }),
  ]);

  return {
    requests: rows.map(toServiceRequestDto),
    total,
    limit: query.limit,
    offset: query.offset,
    tab: query.tab,
  };
}

export async function getServiceRequestDetailForTechnician(
  technicianProfileId: string,
  requestId: string,
): Promise<TechnicianServiceRequestDetailDto | null> {
  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedTechnicianId: technicianProfileId },
    include: doctorServiceRequestDetailInclude,
  });
  return row ? toTechnicianServiceRequestDetailDto(row) : null;
}
