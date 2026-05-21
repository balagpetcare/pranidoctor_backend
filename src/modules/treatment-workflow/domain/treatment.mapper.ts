import type {
  Prescription,
  PrescriptionItem,
  TreatmentCase,
  TreatmentConsultation,
  TreatmentFollowup,
  TreatmentNote,
  TreatmentWorkflow,
} from '../../../generated/prisma/index.js';

import type {
  ConsultationDto,
  DiagnosisDto,
  FollowupDto,
  PrescriptionDto,
  PrescriptionItemDto,
  TreatmentAggregateDto,
  TreatmentNoteDto,
} from '../treatment-workflow.types.js';

export function mapConsultation(row: TreatmentConsultation): ConsultationDto {
  const refs = row.attachmentRefs;
  return {
    id: row.id,
    observations: row.observations,
    diagnosisSummary: row.diagnosisSummary,
    attachmentRefs: Array.isArray(refs) ? refs : refs != null ? [refs] : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapDiagnosis(row: TreatmentCase): DiagnosisDto {
  return {
    treatmentCaseId: row.id,
    status: row.status,
    chiefComplaint: row.chiefComplaint,
    symptoms: row.symptoms,
    diagnosis: row.diagnosis,
    procedures: row.procedures,
    treatmentNotes: row.treatmentNotes,
    recordedAt: row.recordedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapPrescriptionItem(row: PrescriptionItem): PrescriptionItemDto {
  return {
    id: row.id,
    medicineName: row.medicineName,
    dosage: row.dosage,
    duration: row.duration,
    instruction: row.instruction,
    quantity: row.quantity != null ? String(row.quantity) : null,
  };
}

export function mapPrescription(
  row: Prescription & { items: PrescriptionItem[] },
  warnings: string | null = null,
): PrescriptionDto {
  return {
    id: row.id,
    status: row.status,
    instructions: row.instructions,
    warnings,
    validUntil: row.validUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items: row.items.map(mapPrescriptionItem),
  };
}

export function mapFollowup(row: TreatmentFollowup): FollowupDto {
  return {
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    reminderNote: row.reminderNote,
    status: row.status,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapNote(row: TreatmentNote): TreatmentNoteDto {
  return {
    id: row.id,
    noteType: row.noteType,
    content: row.content,
    authorDoctorId: row.authorDoctorId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapAggregate(params: {
  caseId: string;
  workflow: TreatmentWorkflow;
  consultations: TreatmentConsultation[];
  diagnosis: TreatmentCase | null;
  prescriptions: (Prescription & { items: PrescriptionItem[] })[];
  followups: TreatmentFollowup[];
}): TreatmentAggregateDto {
  return {
    caseId: params.caseId,
    workflowId: params.workflow.id,
    workflowStatus: params.workflow.status,
    closedAt: params.workflow.closedAt?.toISOString() ?? null,
    consultations: params.consultations.map(mapConsultation),
    diagnosis: params.diagnosis ? mapDiagnosis(params.diagnosis) : null,
    prescriptions: params.prescriptions.map((p) => mapPrescription(p)),
    followups: params.followups.map(mapFollowup),
  };
}
