import type {
  PrescriptionStatus,
  TreatmentCaseStatus,
  TreatmentFollowupStatus,
  TreatmentNoteType,
  TreatmentWorkflowStatus,
} from '../../generated/prisma/index.js';

export type TreatmentWorkflowState = TreatmentWorkflowStatus;

export type ConsultationDto = {
  id: string;
  observations: string | null;
  diagnosisSummary: string | null;
  attachmentRefs: unknown[] | null;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosisDto = {
  treatmentCaseId: string;
  status: TreatmentCaseStatus;
  chiefComplaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  procedures: string | null;
  treatmentNotes: string | null;
  recordedAt: string;
  updatedAt: string;
};

export type PrescriptionItemDto = {
  id: string;
  medicineName: string;
  dosage: string | null;
  duration: string | null;
  instruction: string | null;
  quantity: string | null;
};

export type PrescriptionDto = {
  id: string;
  status: PrescriptionStatus;
  instructions: string | null;
  warnings: string | null;
  validUntil: string | null;
  createdAt: string;
  items: PrescriptionItemDto[];
};

export type FollowupDto = {
  id: string;
  scheduledAt: string;
  reminderNote: string | null;
  status: TreatmentFollowupStatus;
  completedAt: string | null;
  createdAt: string;
};

export type TreatmentNoteDto = {
  id: string;
  noteType: TreatmentNoteType;
  content: string;
  authorDoctorId: string;
  createdAt: string;
};

export type TreatmentAggregateDto = {
  caseId: string;
  workflowId: string;
  workflowStatus: TreatmentWorkflowState;
  closedAt: string | null;
  consultations: ConsultationDto[];
  diagnosis: DiagnosisDto | null;
  prescriptions: PrescriptionDto[];
  followups: FollowupDto[];
};

export type StartConsultationInput = {
  observations?: string;
  diagnosisSummary?: string;
  attachmentRefs?: { fileId: string; label?: string }[];
};

export type RecordDiagnosisInput = {
  chiefComplaint?: string;
  symptoms?: string;
  diagnosis: string;
  procedures?: string;
  treatmentNotes?: string;
};

export type PrescriptionItemInput = {
  medicineName: string;
  dosage?: string;
  duration?: string;
  instruction?: string;
  warnings?: string;
  quantity?: string;
};

export type CreatePrescriptionInput = {
  instructions?: string;
  warnings?: string;
  validUntil?: string;
  items: PrescriptionItemInput[];
};

export type ScheduleFollowupInput = {
  scheduledAt: string;
  reminderNote?: string;
};

export type CreateNoteInput = {
  noteType: TreatmentNoteType;
  content: string;
};

export type CloseTreatmentInput = {
  closingNote?: string;
};

export type DoctorCaseAccess =
  | { ok: 'ALLOWED'; doctorProfileId: string; animalId: string }
  | { ok: 'NOT_FOUND' }
  | { ok: 'FORBIDDEN' }
  | { ok: 'INVALID_STATUS'; status: string };

export type WorkflowMutationResult<T> =
  | { ok: 'SUCCESS'; data: T }
  | DoctorCaseAccess
  | { ok: 'INVALID_STATE'; current: TreatmentWorkflowState; expected: TreatmentWorkflowState[] }
  | { ok: 'CLOSED' };
