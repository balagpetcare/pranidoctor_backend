import type { Prisma } from '@/generated/prisma/client';
import { PrescriptionStatus } from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';
import {
  toDoctorPrescriptionSummaryDto,
  type DoctorPrescriptionSummaryDto,
} from '@/lib/doctor-service-requests/doctor-clinical-service';

import type { AdminListPrescriptionsQuery } from './schemas';

const listInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      medicineName: true,
      dosage: true,
      duration: true,
      instruction: true,
      quantity: true,
    },
  },
  animal: {
    select: {
      id: true,
      name: true,
      species: true,
      animalType: true,
    },
  },
  doctor: {
    select: {
      id: true,
      displayName: true,
    },
  },
  aiTechnician: {
    select: {
      id: true,
      displayName: true,
    },
  },
  serviceRequest: {
    select: {
      id: true,
      status: true,
      serviceType: true,
      submittedAt: true,
      customer: {
        select: {
          id: true,
          displayName: true,
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PrescriptionInclude;

type PrescriptionListRow = Prisma.PrescriptionGetPayload<{
  include: typeof listInclude;
}>;

const detailInclude = {
  ...listInclude,
  items: {
    orderBy: { createdAt: 'asc' as const },
  },
  serviceRequest: {
    select: {
      id: true,
      status: true,
      serviceType: true,
      submittedAt: true,
      problemOrSymptom: true,
      scheduledStart: true,
      scheduledEnd: true,
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
      treatmentCases: {
        orderBy: { recordedAt: 'desc' as const },
        select: {
          id: true,
          status: true,
          chiefComplaint: true,
          diagnosis: true,
          symptoms: true,
          recordedAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.PrescriptionInclude;

type PrescriptionDetailRow = Prisma.PrescriptionGetPayload<{
  include: typeof detailInclude;
}>;

export type AdminPrescriptionListItemDto = DoctorPrescriptionSummaryDto & {
  serviceRequestId: string;
  animalId: string;
  doctorId: string | null;
  aiTechnicianId: string | null;
  updatedAt: string;
  animal: {
    id: string;
    name: string;
    species: string;
    animalType: string | null;
  };
  doctor: { id: string; displayName: string } | null;
  aiTechnician: { id: string; displayName: string } | null;
  customer: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
  };
  serviceRequest: {
    id: string;
    status: string;
    serviceType: string;
    submittedAt: string;
  };
};

export type AdminTreatmentCaseRefDto = {
  id: string;
  status: string;
  chiefComplaint: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  recordedAt: string;
  updatedAt: string;
};

export type AdminPrescriptionDetailDto = {
  prescription: DoctorPrescriptionSummaryDto & {
    serviceRequestId: string;
    animalId: string;
    doctorId: string | null;
    aiTechnicianId: string | null;
    updatedAt: string;
  };
  items: DoctorPrescriptionSummaryDto['items'];
  doctor: { id: string; displayName: string } | null;
  aiTechnician: { id: string; displayName: string } | null;
  patient: {
    id: string;
    displayName: string;
    userId: string;
    phone: string | null;
    email: string | null;
  };
  animal: AdminPrescriptionListItemDto['animal'];
  serviceRequest: {
    id: string;
    status: string;
    serviceType: string;
    submittedAt: string;
    problemOrSymptom: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
  };
  treatmentCases: AdminTreatmentCaseRefDto[];
};

function buildSearchFilter(search: string): Prisma.PrescriptionWhereInput {
  return {
    OR: [
      { id: { contains: search, mode: 'insensitive' } },
      { instructions: { contains: search, mode: 'insensitive' } },
      { items: { some: { medicineName: { contains: search, mode: 'insensitive' } } } },
      { animal: { name: { contains: search, mode: 'insensitive' } } },
      { doctor: { displayName: { contains: search, mode: 'insensitive' } } },
      {
        serviceRequest: {
          customer: { displayName: { contains: search, mode: 'insensitive' } },
        },
      },
    ],
  };
}

function resolveOrderBy(
  sort: AdminListPrescriptionsQuery['sort'],
): Prisma.PrescriptionOrderByWithRelationInput[] {
  switch (sort) {
    case 'createdAt_asc':
      return [{ createdAt: 'asc' }];
    case 'validUntil_desc':
      return [{ validUntil: { sort: 'desc', nulls: 'last' } }];
    case 'validUntil_asc':
      return [{ validUntil: { sort: 'asc', nulls: 'last' } }];
    case 'updatedAt_desc':
      return [{ updatedAt: 'desc' }];
    case 'createdAt_desc':
    default:
      return [{ createdAt: 'desc' }];
  }
}

function toListItemDto(row: PrescriptionListRow): AdminPrescriptionListItemDto {
  const summary = toDoctorPrescriptionSummaryDto(row);
  const customer = row.serviceRequest.customer;
  return {
    ...summary,
    serviceRequestId: row.serviceRequestId,
    animalId: row.animalId,
    doctorId: row.doctorId,
    aiTechnicianId: row.aiTechnicianId,
    updatedAt: row.updatedAt.toISOString(),
    animal: row.animal,
    doctor: row.doctor,
    aiTechnician: row.aiTechnician,
    customer: {
      id: customer.id,
      displayName: customer.displayName,
      phone: customer.user.phone,
      email: customer.user.email,
    },
    serviceRequest: {
      id: row.serviceRequest.id,
      status: row.serviceRequest.status,
      serviceType: row.serviceRequest.serviceType,
      submittedAt: row.serviceRequest.submittedAt.toISOString(),
    },
  };
}

function toTreatmentCaseRef(row: PrescriptionDetailRow['serviceRequest']['treatmentCases'][number]): AdminTreatmentCaseRefDto {
  return {
    id: row.id,
    status: row.status,
    chiefComplaint: row.chiefComplaint,
    diagnosis: row.diagnosis,
    symptoms: row.symptoms,
    recordedAt: row.recordedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDetailDto(row: PrescriptionDetailRow): AdminPrescriptionDetailDto {
  const summary = toDoctorPrescriptionSummaryDto(row);
  const sr = row.serviceRequest;
  const customer = sr.customer;
  return {
    prescription: {
      ...summary,
      serviceRequestId: row.serviceRequestId,
      animalId: row.animalId,
      doctorId: row.doctorId,
      aiTechnicianId: row.aiTechnicianId,
      updatedAt: row.updatedAt.toISOString(),
    },
    items: summary.items,
    doctor: row.doctor,
    aiTechnician: row.aiTechnician,
    patient: {
      id: customer.id,
      displayName: customer.displayName,
      userId: customer.userId,
      phone: customer.user.phone,
      email: customer.user.email,
    },
    animal: row.animal,
    serviceRequest: {
      id: sr.id,
      status: sr.status,
      serviceType: sr.serviceType,
      submittedAt: sr.submittedAt.toISOString(),
      problemOrSymptom: sr.problemOrSymptom,
      scheduledStart: sr.scheduledStart?.toISOString() ?? null,
      scheduledEnd: sr.scheduledEnd?.toISOString() ?? null,
    },
    treatmentCases: sr.treatmentCases.map(toTreatmentCaseRef),
  };
}

export async function adminListPrescriptions(query: AdminListPrescriptionsQuery) {
  const limit = query.limit ?? 25;
  const offset = query.offset ?? 0;

  const createdAt: Prisma.DateTimeFilter | undefined =
    query.dateFrom || query.dateTo
      ? {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
        }
      : undefined;

  const where: Prisma.PrescriptionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.serviceRequestId ? { serviceRequestId: query.serviceRequestId } : {}),
    ...(query.doctorId ? { doctorId: query.doctorId } : {}),
    ...(query.animalId ? { animalId: query.animalId } : {}),
    ...(query.customerId
      ? { serviceRequest: { customerId: query.customerId } }
      : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(query.search ? buildSearchFilter(query.search) : {}),
  };

  const orderBy = resolveOrderBy(query.sort);

  const [rows, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include: listInclude,
    }),
    prisma.prescription.count({ where }),
  ]);

  return {
    prescriptions: rows.map(toListItemDto),
    total,
    limit,
    offset,
  };
}

export async function adminGetPrescription(prescriptionId: string): Promise<AdminPrescriptionDetailDto | null> {
  const row = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: detailInclude,
  });
  return row ? toDetailDto(row) : null;
}

/** Prescriptions for a service request (admin SR detail panel). */
export async function adminListPrescriptionsForServiceRequest(
  serviceRequestId: string,
): Promise<DoctorPrescriptionSummaryDto[]> {
  const rows = await prisma.prescription.findMany({
    where: { serviceRequestId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
    },
  });
  return rows.map((row) => toDoctorPrescriptionSummaryDto(row));
}

export { PrescriptionStatus };
