import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authDoctor, requireRole } from '../../shared/security/middleware/auth.middleware.js';

import type { TreatmentWorkflowController } from './treatment-workflow.controller.js';

export function configureTreatmentWorkflowRoutes(
  router: Router,
  controller: TreatmentWorkflowController,
): void {
  const doctorGuard = [authDoctor, requireRole('DOCTOR')] as const;

  router.get('/:id/treatment', ...doctorGuard, asyncHandler(controller.getTreatment.bind(controller)));

  router.post(
    '/:id/consultation',
    ...doctorGuard,
    asyncHandler(controller.startConsultation.bind(controller)),
  );

  router.post(
    '/:id/diagnosis',
    ...doctorGuard,
    asyncHandler(controller.recordDiagnosis.bind(controller)),
  );

  router.post(
    '/:id/prescription',
    ...doctorGuard,
    asyncHandler(controller.createPrescription.bind(controller)),
  );

  router.post(
    '/:id/followup',
    ...doctorGuard,
    asyncHandler(controller.scheduleFollowup.bind(controller)),
  );

  router.post('/:id/close', ...doctorGuard, asyncHandler(controller.closeTreatment.bind(controller)));

  router.get('/:id/notes', ...doctorGuard, asyncHandler(controller.listNotes.bind(controller)));

  router.post('/:id/notes', ...doctorGuard, asyncHandler(controller.createNote.bind(controller)));
}
