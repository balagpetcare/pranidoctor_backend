import type { Prisma } from '../../generated/prisma/index.js';
import {
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../generated/prisma/index.js';

export const SERVICE_TYPE_EXPECTED_CATEGORY_SLUG: Record<ServiceRequestType, string> = {
  [ServiceRequestType.DOCTOR_HOME_VISIT]: 'doctor-visit',
  [ServiceRequestType.EMERGENCY_DOCTOR]: 'emergency',
  [ServiceRequestType.AI_SERVICE]: 'ai-service',
  [ServiceRequestType.ONLINE_CONSULTATION_LATER]: 'online-consultation',
};

export const CUSTOMER_CANCELLABLE_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.PENDING,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.ASSIGNED,
];

export const serviceRequestInclude = {
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
} satisfies Prisma.ServiceRequestInclude;

export type ServiceRequestWithRelations = Prisma.ServiceRequestGetPayload<{
  include: typeof serviceRequestInclude;
}>;

export function toServiceRequestDto(row: ServiceRequestWithRelations) {
  return {
    id: row.id,
    customerId: row.customerId,
    animalId: row.animalId,
    serviceCategoryId: row.serviceCategoryId,
    serviceCategory: row.serviceCategory,
    serviceType: row.serviceType,
    problemOrSymptom: row.problemOrSymptom,
    description: row.description,
    areaId: row.areaId,
    villageId: row.villageId,
    locationText: row.locationText,
    preferredTime: row.preferredTime,
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
    status: row.status,
    assignedDoctorId: row.assignedDoctorId,
    assignedTechnicianId: row.assignedTechnicianId,
    assignedDoctor: row.assignedDoctor,
    assignedTechnician: row.assignedTechnician,
    animal: row.animal,
    isEmergency: row.isEmergency,
    emergencyNotes: row.emergencyNotes,
    urgency: row.urgency,
    submittedAt: row.submittedAt.toISOString(),
    assignedAt: row.assignedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
