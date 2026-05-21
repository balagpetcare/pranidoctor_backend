import {
  ServiceRequestEventType,
  ServiceRequestStatus,
  TreatmentCaseStatus,
  UserRole,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { appendTimelineEvent } from '../timeline/timeline.service.js';

const DOCTOR_CLINICAL_REQUEST_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.IN_PROGRESS,
];

export type DoctorClinicalAccessResult =
  | { ok: 'ALLOWED'; animalId: string; status: ServiceRequestStatus }
  | { ok: 'NOT_FOUND' }
  | { ok: 'INVALID_STATUS'; status: ServiceRequestStatus };

export async function assertDoctorClinicalCaseAccess(
  doctorProfileId: string,
  requestId: string,
): Promise<DoctorClinicalAccessResult> {
  const prisma = getPrisma();
  const req = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    select: { animalId: true, status: true },
  });
  if (!req) return { ok: 'NOT_FOUND' };
  if (!DOCTOR_CLINICAL_REQUEST_STATUSES.includes(req.status)) {
    return { ok: 'INVALID_STATUS', status: req.status };
  }
  return { ok: 'ALLOWED', animalId: req.animalId, status: req.status };
}

export type CreateTreatmentBody = {
  chiefComplaint?: string;
  symptoms?: string;
  diagnosis?: string;
  procedures?: string;
  treatmentNotes?: string;
  followUpNotes?: string;
  followUpDate?: string;
};

export type TreatmentSummary = {
  id: string;
  status: TreatmentCaseStatus;
  chiefComplaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  procedures: string | null;
  treatmentNotes: string | null;
  followUpNotes: string | null;
  followUpDate: string | null;
  recordedAt: string;
  updatedAt: string;
};

function parseOptionalDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toTreatmentSummary(row: {
  id: string;
  status: TreatmentCaseStatus;
  chiefComplaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  procedures: string | null;
  treatmentNotes: string | null;
  followUpNotes: string | null;
  followUpDate: Date | null;
  recordedAt: Date;
  updatedAt: Date;
}): TreatmentSummary {
  return {
    id: row.id,
    status: row.status,
    chiefComplaint: row.chiefComplaint,
    symptoms: row.symptoms,
    diagnosis: row.diagnosis,
    procedures: row.procedures,
    treatmentNotes: row.treatmentNotes,
    followUpNotes: row.followUpNotes,
    followUpDate: row.followUpDate?.toISOString() ?? null,
    recordedAt: row.recordedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTreatmentCaseForDoctor(
  doctorProfileId: string,
  requestId: string,
  body: CreateTreatmentBody,
): Promise<
  | { ok: 'CREATED'; treatment: TreatmentSummary }
  | DoctorClinicalAccessResult
> {
  const access = await assertDoctorClinicalCaseAccess(doctorProfileId, requestId);
  if (access.ok !== 'ALLOWED') return access;

  const prisma = getPrisma();
  const followUp = parseOptionalDate(body.followUpDate);

  const created = await prisma.treatmentCase.create({
    data: {
      serviceRequestId: requestId,
      animalId: access.animalId,
      doctorId: doctorProfileId,
      status: TreatmentCaseStatus.FINALIZED,
      chiefComplaint: body.chiefComplaint?.trim() || null,
      symptoms: body.symptoms?.trim() || null,
      diagnosis: body.diagnosis?.trim() || null,
      procedures: body.procedures?.trim() || null,
      treatmentNotes: body.treatmentNotes?.trim() || null,
      followUpNotes: body.followUpNotes?.trim() || null,
      followUpDate: followUp,
    },
  });

  if (access.status !== ServiceRequestStatus.IN_PROGRESS) {
    await prisma.serviceRequest.updateMany({
      where: {
        id: requestId,
        assignedDoctorId: doctorProfileId,
        status: { in: DOCTOR_CLINICAL_REQUEST_STATUSES },
      },
      data: {
        status: ServiceRequestStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });
  }

  await appendTimelineEvent({
    serviceRequestId: requestId,
    eventType: ServiceRequestEventType.CASE_OPENED,
    actorRole: UserRole.DOCTOR,
    metadata: { treatmentCaseId: created.id },
  });

  return {
    ok: 'CREATED',
    treatment: toTreatmentSummary(created),
  };
}

export { toTreatmentSummary };
