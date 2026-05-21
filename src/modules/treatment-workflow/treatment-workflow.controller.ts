import type { Request, Response } from 'express';
import { z } from 'zod';

import { ConflictError, UnauthorizedError, ValidationError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';

import { mapAccessError } from './guards/treatment-access.guard.js';
import { getTreatmentWorkflowService } from './treatment-workflow.service.js';
import type { WorkflowMutationResult } from './treatment-workflow.types.js';

const attachmentRefSchema = z.object({
  fileId: z.string().min(1),
  label: z.string().optional(),
});

const consultationSchema = z.object({
  observations: z.string().optional(),
  diagnosisSummary: z.string().optional(),
  attachmentRefs: z.array(attachmentRefSchema).optional(),
});

const diagnosisSchema = z.object({
  chiefComplaint: z.string().optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().min(1),
  procedures: z.string().optional(),
  treatmentNotes: z.string().optional(),
});

const prescriptionItemSchema = z.object({
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  duration: z.string().optional(),
  instruction: z.string().optional(),
  warnings: z.string().optional(),
  quantity: z.string().optional(),
});

const prescriptionSchema = z.object({
  instructions: z.string().optional(),
  warnings: z.string().optional(),
  validUntil: z.string().optional(),
  items: z.array(prescriptionItemSchema).min(1),
});

const followupSchema = z.object({
  scheduledAt: z.string().min(1),
  reminderNote: z.string().optional(),
});

const closeSchema = z.object({
  closingNote: z.string().optional(),
});

const noteSchema = z.object({
  noteType: z.enum(['PRIVATE', 'SHARED', 'AUDIT']),
  content: z.string().min(1),
});

function caseId(req: Request): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw new ValidationError('VALIDATION_FAILED', 'Case id required');
  return id;
}

function userId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  }
  return req.user.id;
}

function handleMutation<T>(result: WorkflowMutationResult<T>): T {
  if (result.ok === 'SUCCESS') return result.data;
  if (result.ok === 'NOT_FOUND' || result.ok === 'FORBIDDEN' || result.ok === 'INVALID_STATUS') {
    mapAccessError(result);
  }
  if (result.ok === 'CLOSED') {
    throw new ConflictError('WORKFLOW_CLOSED', 'Treatment workflow is closed');
  }
  if (result.ok === 'INVALID_STATE') {
    throw new ConflictError(
      'WORKFLOW_INVALID_STATE',
      `Invalid workflow state ${result.current}; expected one of ${result.expected.join(', ')}`,
    );
  }
  throw new ConflictError('WORKFLOW_ERROR', 'Treatment workflow mutation failed');
}

export class TreatmentWorkflowController {
  async getTreatment(req: Request, res: Response): Promise<void> {
    const data = await getTreatmentWorkflowService().getTreatment(userId(req), caseId(req));
    sendSuccess(res, data);
  }

  async startConsultation(req: Request, res: Response): Promise<void> {
    const body = consultationSchema.parse(req.body);
    const data = handleMutation(
      await getTreatmentWorkflowService().startConsultation(userId(req), caseId(req), {
        ...(body.observations !== undefined ? { observations: body.observations } : {}),
        ...(body.diagnosisSummary !== undefined ? { diagnosisSummary: body.diagnosisSummary } : {}),
        ...(body.attachmentRefs !== undefined
          ? {
              attachmentRefs: body.attachmentRefs.map((ref) => ({
                fileId: ref.fileId,
                ...(ref.label !== undefined ? { label: ref.label } : {}),
              })),
            }
          : {}),
      }),
    );
    sendCreated(res, data);
  }

  async recordDiagnosis(req: Request, res: Response): Promise<void> {
    const body = diagnosisSchema.parse(req.body);
    const data = handleMutation(
      await getTreatmentWorkflowService().recordDiagnosis(userId(req), caseId(req), {
        diagnosis: body.diagnosis,
        ...(body.chiefComplaint !== undefined ? { chiefComplaint: body.chiefComplaint } : {}),
        ...(body.symptoms !== undefined ? { symptoms: body.symptoms } : {}),
        ...(body.procedures !== undefined ? { procedures: body.procedures } : {}),
        ...(body.treatmentNotes !== undefined ? { treatmentNotes: body.treatmentNotes } : {}),
      }),
    );
    sendCreated(res, data);
  }

  async createPrescription(req: Request, res: Response): Promise<void> {
    const body = prescriptionSchema.parse(req.body);
    const data = handleMutation(
      await getTreatmentWorkflowService().createPrescription(userId(req), caseId(req), {
        items: body.items.map((item) => ({
          medicineName: item.medicineName,
          ...(item.dosage !== undefined ? { dosage: item.dosage } : {}),
          ...(item.duration !== undefined ? { duration: item.duration } : {}),
          ...(item.instruction !== undefined ? { instruction: item.instruction } : {}),
          ...(item.warnings !== undefined ? { warnings: item.warnings } : {}),
          ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
        })),
        ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
        ...(body.warnings !== undefined ? { warnings: body.warnings } : {}),
        ...(body.validUntil !== undefined ? { validUntil: body.validUntil } : {}),
      }),
    );
    sendCreated(res, data);
  }

  async scheduleFollowup(req: Request, res: Response): Promise<void> {
    const body = followupSchema.parse(req.body);
    const data = handleMutation(
      await getTreatmentWorkflowService().scheduleFollowup(userId(req), caseId(req), {
        scheduledAt: body.scheduledAt,
        ...(body.reminderNote !== undefined ? { reminderNote: body.reminderNote } : {}),
      }),
    );
    sendCreated(res, data);
  }

  async closeTreatment(req: Request, res: Response): Promise<void> {
    const body = closeSchema.parse(req.body ?? {});
    const data = handleMutation(
      await getTreatmentWorkflowService().closeTreatment(userId(req), caseId(req), {
        ...(body.closingNote !== undefined ? { closingNote: body.closingNote } : {}),
      }),
    );
    sendSuccess(res, data);
  }

  async listNotes(req: Request, res: Response): Promise<void> {
    const data = await getTreatmentWorkflowService().listNotes(userId(req), caseId(req));
    sendSuccess(res, data);
  }

  async createNote(req: Request, res: Response): Promise<void> {
    const body = noteSchema.parse(req.body);
    const data = handleMutation(
      await getTreatmentWorkflowService().createNote(userId(req), caseId(req), body),
    );
    sendCreated(res, data);
  }
}
