import {
  PrescriptionStatus,
  Prisma,
  ServiceRequestStatus,
  TreatmentCaseStatus,
  TreatmentFollowupStatus,
  TreatmentNoteType,
  TreatmentWorkflowStatus,
} from '../../generated/prisma/index.js';
import { ConflictError } from '../../shared/errors/http.errors.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { mapAggregate, mapConsultation, mapFollowup, mapNote, mapPrescription } from './domain/treatment.mapper.js';
import { canTransition, expectedFromStates, isMutableState } from './domain/workflow.transitions.js';
import {
  appendTreatmentAudit,
  assertAssignedDoctorAccess,
  mapAccessError,
} from './guards/treatment-access.guard.js';
import type {
  CloseTreatmentInput,
  CreateNoteInput,
  CreatePrescriptionInput,
  RecordDiagnosisInput,
  ScheduleFollowupInput,
  StartConsultationInput,
  TreatmentAggregateDto,
  TreatmentNoteDto,
  WorkflowMutationResult,
} from './treatment-workflow.types.js';

function parseOptionalDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function invalidState<T>(
  current: TreatmentWorkflowStatus,
  expected: TreatmentWorkflowStatus[],
): WorkflowMutationResult<T> {
  return { ok: 'INVALID_STATE', current, expected };
}

function closed<T>(): WorkflowMutationResult<T> {
  return { ok: 'CLOSED' };
}

export class TreatmentWorkflowService {
  readonly name = 'TreatmentWorkflowService';

  async getTreatment(userId: string, caseId: string): Promise<TreatmentAggregateDto> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') {
      mapAccessError(access);
    }
    const doctorProfileId = access.doctorProfileId;

    const prisma = getPrisma();
    let workflow = await prisma.treatmentWorkflow.findUnique({
      where: { serviceRequestId: caseId },
    });

    if (!workflow) {
      workflow = await prisma.treatmentWorkflow.create({
        data: {
          serviceRequestId: caseId,
          doctorId: doctorProfileId,
          status: TreatmentWorkflowStatus.ASSIGNED,
        },
      });
    }

    const [consultations, diagnosis, prescriptions, followups] = await Promise.all([
      prisma.treatmentConsultation.findMany({
        where: { workflowId: workflow.id },
        orderBy: { createdAt: 'asc' },
      }),
      workflow.treatmentCaseId
        ? prisma.treatmentCase.findUnique({ where: { id: workflow.treatmentCaseId } })
        : Promise.resolve(null),
      prisma.prescription.findMany({
        where: { serviceRequestId: caseId, doctorId: doctorProfileId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.treatmentFollowup.findMany({
        where: { workflowId: workflow.id },
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    return mapAggregate({
      caseId,
      workflow,
      consultations,
      diagnosis,
      prescriptions,
      followups,
    });
  }

  async startConsultation(
    userId: string,
    caseId: string,
    input: StartConsultationInput,
  ): Promise<WorkflowMutationResult<{ consultation: ReturnType<typeof mapConsultation>; workflowStatus: TreatmentWorkflowStatus }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (!isMutableState(workflow.status)) return closed();
    if (!canTransition(workflow.status, TreatmentWorkflowStatus.CONSULTATION_STARTED)) {
      return invalidState(workflow.status, expectedFromStates(TreatmentWorkflowStatus.CONSULTATION_STARTED));
    }

    const consultation = await prisma.$transaction(async (tx) => {
      const created = await tx.treatmentConsultation.create({
        data: {
          serviceRequestId: caseId,
          workflowId: workflow.id,
          doctorId: access.doctorProfileId,
          observations: input.observations?.trim() || null,
          diagnosisSummary: input.diagnosisSummary?.trim() || null,
          ...(input.attachmentRefs?.length
            ? { attachmentRefs: input.attachmentRefs as Prisma.InputJsonValue }
            : {}),
        },
      });

      await tx.treatmentWorkflow.update({
        where: { id: workflow.id },
        data: { status: TreatmentWorkflowStatus.CONSULTATION_STARTED },
      });

      await tx.serviceRequest.updateMany({
        where: {
          id: caseId,
          assignedDoctorId: access.doctorProfileId,
          status: {
            in: [
              ServiceRequestStatus.ASSIGNED,
              ServiceRequestStatus.ACCEPTED,
              ServiceRequestStatus.IN_PROGRESS,
            ],
          },
        },
        data: {
          status: ServiceRequestStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      return created;
    });

    await appendTreatmentAudit({
      caseId,
      actorUserId: userId,
      eventType: 'CASE_OPENED',
      metadata: {
        workflowStatus: TreatmentWorkflowStatus.CONSULTATION_STARTED,
        consultationId: consultation.id,
      },
    });

    return {
      ok: 'SUCCESS',
      data: {
        consultation: mapConsultation(consultation),
        workflowStatus: TreatmentWorkflowStatus.CONSULTATION_STARTED,
      },
    };
  }

  async recordDiagnosis(
    userId: string,
    caseId: string,
    input: RecordDiagnosisInput,
  ): Promise<WorkflowMutationResult<{ diagnosis: TreatmentAggregateDto['diagnosis']; workflowStatus: TreatmentWorkflowStatus }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (!isMutableState(workflow.status)) return closed();
    if (!canTransition(workflow.status, TreatmentWorkflowStatus.DIAGNOSED)) {
      return invalidState(workflow.status, expectedFromStates(TreatmentWorkflowStatus.DIAGNOSED));
    }

    const treatmentCase = await prisma.$transaction(async (tx) => {
      let row = workflow.treatmentCaseId
        ? await tx.treatmentCase.findUnique({ where: { id: workflow.treatmentCaseId } })
        : null;

      if (row) {
        row = await tx.treatmentCase.update({
          where: { id: row.id },
          data: {
            chiefComplaint: input.chiefComplaint?.trim() || row.chiefComplaint,
            symptoms: input.symptoms?.trim() || row.symptoms,
            diagnosis: input.diagnosis.trim(),
            procedures: input.procedures?.trim() || row.procedures,
            treatmentNotes: input.treatmentNotes?.trim() || row.treatmentNotes,
            status: TreatmentCaseStatus.FINALIZED,
          },
        });
      } else {
        row = await tx.treatmentCase.create({
          data: {
            serviceRequestId: caseId,
            animalId: access.animalId,
            doctorId: access.doctorProfileId,
            chiefComplaint: input.chiefComplaint?.trim() || null,
            symptoms: input.symptoms?.trim() || null,
            diagnosis: input.diagnosis.trim(),
            procedures: input.procedures?.trim() || null,
            treatmentNotes: input.treatmentNotes?.trim() || null,
            status: TreatmentCaseStatus.FINALIZED,
          },
        });
      }

      await tx.treatmentWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: TreatmentWorkflowStatus.DIAGNOSED,
          treatmentCaseId: row.id,
        },
      });

      return row;
    });

    await appendTreatmentAudit({
      caseId,
      actorUserId: userId,
      eventType: 'CASE_UPDATED',
      metadata: {
        workflowStatus: TreatmentWorkflowStatus.DIAGNOSED,
        treatmentCaseId: treatmentCase.id,
      },
    });

    const { mapDiagnosis } = await import('./domain/treatment.mapper.js');
    return {
      ok: 'SUCCESS',
      data: {
        diagnosis: mapDiagnosis(treatmentCase),
        workflowStatus: TreatmentWorkflowStatus.DIAGNOSED,
      },
    };
  }

  async createPrescription(
    userId: string,
    caseId: string,
    input: CreatePrescriptionInput,
  ): Promise<WorkflowMutationResult<{ prescription: ReturnType<typeof mapPrescription>; workflowStatus: TreatmentWorkflowStatus }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    if (!input.items.length) {
      throw new ConflictError('PRESCRIPTION_EMPTY', 'At least one prescription item is required');
    }

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (!isMutableState(workflow.status)) return closed();
    if (!canTransition(workflow.status, TreatmentWorkflowStatus.PRESCRIBED)) {
      return invalidState(workflow.status, expectedFromStates(TreatmentWorkflowStatus.PRESCRIBED));
    }

    const validUntil = parseOptionalDate(input.validUntil);
    const warnings = input.warnings?.trim() || null;

    const prescription = await prisma.$transaction(async (tx) => {
      const created = await tx.prescription.create({
        data: {
          serviceRequestId: caseId,
          animalId: access.animalId,
          doctorId: access.doctorProfileId,
          status: PrescriptionStatus.ACTIVE,
          instructions: [input.instructions?.trim(), warnings ? `Warnings: ${warnings}` : null]
            .filter(Boolean)
            .join('\n') || null,
          validUntil,
          items: {
            create: input.items.map((item: CreatePrescriptionInput['items'][number]) => ({
              medicineName: item.medicineName.trim(),
              dosage: item.dosage?.trim() || null,
              duration: item.duration?.trim() || null,
              instruction: [item.instruction?.trim(), item.warnings?.trim()]
                .filter(Boolean)
                .join('\n') || null,
              quantity: item.quantity?.trim()
                ? new Prisma.Decimal(item.quantity.trim())
                : null,
            })),
          },
        },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });

      await tx.treatmentWorkflow.update({
        where: { id: workflow.id },
        data: { status: TreatmentWorkflowStatus.PRESCRIBED },
      });

      return created;
    });

    await appendTreatmentAudit({
      caseId,
      actorUserId: userId,
      eventType: 'CASE_UPDATED',
      metadata: {
        workflowStatus: TreatmentWorkflowStatus.PRESCRIBED,
        prescriptionId: prescription.id,
      },
    });

    return {
      ok: 'SUCCESS',
      data: {
        prescription: mapPrescription(prescription, warnings),
        workflowStatus: TreatmentWorkflowStatus.PRESCRIBED,
      },
    };
  }

  async scheduleFollowup(
    userId: string,
    caseId: string,
    input: ScheduleFollowupInput,
  ): Promise<WorkflowMutationResult<{ followup: ReturnType<typeof mapFollowup>; workflowStatus: TreatmentWorkflowStatus }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    const scheduledAt = parseOptionalDate(input.scheduledAt);
    if (!scheduledAt) {
      throw new ConflictError('FOLLOWUP_INVALID_DATE', 'Valid scheduledAt is required');
    }

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (!isMutableState(workflow.status)) return closed();
    if (!canTransition(workflow.status, TreatmentWorkflowStatus.FOLLOWUP_PENDING)) {
      return invalidState(workflow.status, expectedFromStates(TreatmentWorkflowStatus.FOLLOWUP_PENDING));
    }

    const followup = await prisma.$transaction(async (tx) => {
      const created = await tx.treatmentFollowup.create({
        data: {
          serviceRequestId: caseId,
          workflowId: workflow.id,
          doctorId: access.doctorProfileId,
          scheduledAt,
          reminderNote: input.reminderNote?.trim() || null,
          status: TreatmentFollowupStatus.PENDING,
        },
      });

      await tx.treatmentWorkflow.update({
        where: { id: workflow.id },
        data: { status: TreatmentWorkflowStatus.FOLLOWUP_PENDING },
      });

      return created;
    });

    await appendTreatmentAudit({
      caseId,
      actorUserId: userId,
      eventType: 'CASE_UPDATED',
      metadata: {
        workflowStatus: TreatmentWorkflowStatus.FOLLOWUP_PENDING,
        followupId: followup.id,
      },
    });

    return {
      ok: 'SUCCESS',
      data: {
        followup: mapFollowup(followup),
        workflowStatus: TreatmentWorkflowStatus.FOLLOWUP_PENDING,
      },
    };
  }

  async closeTreatment(
    userId: string,
    caseId: string,
    input: CloseTreatmentInput,
  ): Promise<WorkflowMutationResult<{ workflowStatus: TreatmentWorkflowStatus; closedAt: string }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (workflow.status === TreatmentWorkflowStatus.CLOSED) return closed();
    if (!canTransition(workflow.status, TreatmentWorkflowStatus.CLOSED)) {
      return invalidState(workflow.status, expectedFromStates(TreatmentWorkflowStatus.CLOSED));
    }

    const closedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.treatmentWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: TreatmentWorkflowStatus.CLOSED,
          closedAt,
        },
      });

      await tx.treatmentFollowup.updateMany({
        where: {
          workflowId: workflow.id,
          status: TreatmentFollowupStatus.PENDING,
        },
        data: {
          status: TreatmentFollowupStatus.COMPLETED,
          completedAt: closedAt,
        },
      });

      if (input.closingNote?.trim()) {
        await tx.treatmentNote.create({
          data: {
            serviceRequestId: caseId,
            workflowId: workflow.id,
            authorDoctorId: access.doctorProfileId,
            noteType: TreatmentNoteType.AUDIT,
            content: input.closingNote.trim(),
          },
        });
      }
    });

    await appendTreatmentAudit({
      caseId,
      actorUserId: userId,
      eventType: 'COMPLETED',
      metadata: { workflowStatus: TreatmentWorkflowStatus.CLOSED },
      ...(input.closingNote?.trim() ? { note: input.closingNote.trim() } : {}),
    });

    return {
      ok: 'SUCCESS',
      data: {
        workflowStatus: TreatmentWorkflowStatus.CLOSED,
        closedAt: closedAt.toISOString(),
      },
    };
  }

  async listNotes(userId: string, caseId: string): Promise<TreatmentNoteDto[]> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') {
      mapAccessError(access);
    }
    const doctorProfileId = access.doctorProfileId;

    const prisma = getPrisma();
    const workflow = await prisma.treatmentWorkflow.findUnique({
      where: { serviceRequestId: caseId },
    });
    if (!workflow) return [];

    const rows = await prisma.treatmentNote.findMany({
      where: {
        workflowId: workflow.id,
        OR: [
          { noteType: TreatmentNoteType.SHARED },
          { noteType: TreatmentNoteType.AUDIT },
          { noteType: TreatmentNoteType.PRIVATE, authorDoctorId: doctorProfileId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(mapNote);
  }

  async createNote(
    userId: string,
    caseId: string,
    input: CreateNoteInput,
  ): Promise<WorkflowMutationResult<{ note: TreatmentNoteDto }>> {
    const access = await assertAssignedDoctorAccess(userId, caseId);
    if (access.ok !== 'ALLOWED') return access;

    const prisma = getPrisma();
    const workflow = await this.ensureWorkflow(prisma, caseId, access.doctorProfileId);
    if (!isMutableState(workflow.status)) return closed();

    const note = await prisma.treatmentNote.create({
      data: {
        serviceRequestId: caseId,
        workflowId: workflow.id,
        authorDoctorId: access.doctorProfileId,
        noteType: input.noteType,
        content: input.content.trim(),
      },
    });

    if (input.noteType === TreatmentNoteType.AUDIT) {
      await appendTreatmentAudit({
        caseId,
        actorUserId: userId,
        eventType: 'CASE_UPDATED',
        metadata: { noteId: note.id, noteType: input.noteType },
        note: input.content.trim(),
      });
    }

    return { ok: 'SUCCESS', data: { note: mapNote(note) } };
  }

  private async ensureWorkflow(
    prisma: ReturnType<typeof getPrisma>,
    caseId: string,
    doctorProfileId: string,
  ) {
    const existing = await prisma.treatmentWorkflow.findUnique({
      where: { serviceRequestId: caseId },
    });
    if (existing) return existing;

    return prisma.treatmentWorkflow.create({
      data: {
        serviceRequestId: caseId,
        doctorId: doctorProfileId,
        status: TreatmentWorkflowStatus.ASSIGNED,
      },
    });
  }
}

let service: TreatmentWorkflowService | null = null;

export function getTreatmentWorkflowService(): TreatmentWorkflowService {
  if (!service) service = new TreatmentWorkflowService();
  return service;
}
