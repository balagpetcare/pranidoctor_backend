import {
  ProviderStatus,
  ServiceRequestEventType,
  ServiceRequestStatus,
  ServiceRequestType,
  UserStatus,
} from '../../generated/prisma/index.js';

export type MockServiceRequest = {
  id: string;
  customerId: string;
  animalId: string;
  animalType: string;
  serviceType: ServiceRequestType;
  status: ServiceRequestStatus;
  assignedDoctorId: string | null;
  isEmergency: boolean;
  problemOrSymptom: string;
};

export type MockTimelineEvent = {
  serviceRequestId: string;
  eventType: ServiceRequestEventType;
};

export function createEmergencyValidationStore() {
  const requests = new Map<string, MockServiceRequest>();
  const activeDoctors = new Set<string>();
  const timeline: MockTimelineEvent[] = [];
  let idSeq = 0;

  const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

  function seedDoctor(doctorProfileId: string) {
    activeDoctors.add(doctorProfileId);
  }

  function seedRequest(partial: Partial<MockServiceRequest> & Pick<MockServiceRequest, 'customerId' | 'animalType'>) {
    const id = partial.id ?? nextId('sr');
    const row: MockServiceRequest = {
      id,
      animalId: partial.animalId ?? 'animal-1',
      serviceType: partial.serviceType ?? ServiceRequestType.EMERGENCY_DOCTOR,
      status: partial.status ?? ServiceRequestStatus.PENDING,
      assignedDoctorId: partial.assignedDoctorId ?? null,
      isEmergency: partial.isEmergency ?? true,
      problemOrSymptom: partial.problemOrSymptom ?? 'Emergency',
      ...partial,
    };
    requests.set(id, row);
    return row;
  }

  const prismaMock = {
    doctorProfile: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        activeDoctors.has(where.id) ? { id: where.id } : null,
    },
    serviceRequest: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        requests.get(where.id) ?? null,
      findFirst: async ({
        where,
      }: {
        where: { id?: string; assignedDoctorId?: string; customerId?: string };
      }) => {
        for (const r of requests.values()) {
          if (where.id && r.id !== where.id) continue;
          if (where.assignedDoctorId && r.assignedDoctorId !== where.assignedDoctorId) continue;
          if (where.customerId && r.customerId !== where.customerId) continue;
          return r;
        }
        return null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          assignedDoctorId?: string;
          status?: ServiceRequestStatus | { in: ServiceRequestStatus[] };
        };
        data: Partial<MockServiceRequest>;
      }) => {
        const row = requests.get(where.id);
        if (!row) return { count: 0 };
        if (where.assignedDoctorId && row.assignedDoctorId !== where.assignedDoctorId) {
          return { count: 0 };
        }
        if (where.status) {
          const statuses = Array.isArray((where.status as { in: ServiceRequestStatus[] }).in)
            ? (where.status as { in: ServiceRequestStatus[] }).in
            : [where.status as ServiceRequestStatus];
          if (!statuses.includes(row.status)) return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockServiceRequest> & { cancelledAt?: Date; cancelReason?: string | null };
      }) => {
        const row = requests.get(where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        const now = new Date();
        return {
          ...row,
          serviceCategoryId: 'cat-1',
          description: null,
          areaId: null,
          villageId: null,
          locationText: null,
          preferredTime: null,
          scheduledStart: null,
          scheduledEnd: null,
          assignedTechnicianId: null,
          emergencyNotes: null,
          urgency: null,
          submittedAt: now,
          assignedAt: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: data.cancelledAt ?? null,
          cancelReason: data.cancelReason ?? null,
          createdAt: now,
          updatedAt: now,
          serviceCategory: { id: 'cat-1', name: 'Emergency', slug: 'emergency' },
          animal: {
            id: row.animalId,
            name: 'Test',
            species: row.animalType,
            active: true,
            animalType: row.animalType,
          },
          assignedDoctor: null,
          assignedTechnician: null,
        };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const id = nextId('sr');
        const animalType =
          (await prismaMock.animalProfile.findFirst())?.animalType ?? 'CATTLE';
        const row = {
          id,
          customerId: data.customerId as string,
          animalId: (data.animalId as string) ?? 'animal-1',
          serviceCategoryId: (data.serviceCategoryId as string) ?? 'cat-1',
          serviceType: data.serviceType as ServiceRequestType,
          problemOrSymptom: data.problemOrSymptom as string,
          description: null,
          areaId: null,
          villageId: null,
          locationText: null,
          preferredTime: null,
          scheduledStart: null,
          scheduledEnd: null,
          status: ServiceRequestStatus.PENDING,
          assignedDoctorId: null,
          assignedTechnicianId: null,
          isEmergency: Boolean(data.isEmergency),
          priority: data.priority,
          emergencyNotes: null,
          urgency: null,
          submittedAt: now,
          assignedAt: null,
          startedAt: null,
          completedAt: null,
          cancelledAt: null,
          cancelReason: null,
          createdAt: now,
          updatedAt: now,
          serviceCategory: { id: 'cat-1', name: 'Emergency', slug: 'emergency' },
          animal: {
            id: 'animal-1',
            name: 'Test',
            species: animalType,
            active: true,
            animalType,
          },
          assignedDoctor: null,
          assignedTechnician: null,
        };
        requests.set(id, {
          id,
          customerId: row.customerId,
          animalId: row.animalId,
          animalType,
          serviceType: row.serviceType,
          status: row.status,
          assignedDoctorId: null,
          isEmergency: row.isEmergency,
          problemOrSymptom: row.problemOrSymptom,
        });
        return row;
      },
    },
    serviceRequestTimelineEvent: {
      create: async ({ data }: { data: MockTimelineEvent }) => {
        timeline.push(data);
        return { id: nextId('evt'), ...data, createdAt: new Date() };
      },
    },
    animalProfile: {
      findFirst: async () => ({
        id: 'animal-1',
        customerId: 'cust-1',
        active: true,
        animalType: 'CATTLE',
      }),
    },
    serviceCategory: {
      findUnique: async () => ({ id: 'cat-1', slug: 'emergency', name: 'Emergency' }),
    },
    area: { findUnique: async () => null },
    village: { findUnique: async () => null },
  };

  return {
    requests,
    timeline,
    seedDoctor,
    seedRequest,
    prismaMock,
    reset() {
      requests.clear();
      activeDoctors.clear();
      timeline.length = 0;
      idSeq = 0;
    },
  };
}

/** ProviderStatus / UserStatus used by assertAssignableDoctor — harness only checks id set. */
export const HARNESS_DOCTOR_ACTIVE = {
  providerStatus: ProviderStatus.ACTIVE,
  user: { status: UserStatus.ACTIVE },
};
