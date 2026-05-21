import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { DoctorsController } from './doctors.controller.js';
import {
  createDoctorSchema,
  updateDoctorSchema,
  verifyDoctorSchema,
  doctorFilterSchema,
  doctorScheduleSchema,
} from './doctors.validator.js';
import { z } from 'zod';

export function configureDoctorsRoutes(router: Router, controller: DoctorsController): void {
  router.post(
    '/',
    createValidationMiddleware(createDoctorSchema),
    controller.create
  );

  router.get(
    '/',
    createValidationMiddleware(doctorFilterSchema),
    controller.list
  );

  router.get('/:id', controller.getById);

  router.patch(
    '/:id',
    createValidationMiddleware(updateDoctorSchema),
    controller.update
  );

  router.post(
    '/:id/verify',
    createValidationMiddleware(verifyDoctorSchema),
    controller.verify
  );

  router.get('/:id/schedule', controller.getSchedule);

  router.put(
    '/:id/schedule',
    createValidationMiddleware(z.array(doctorScheduleSchema)),
    controller.setSchedule
  );
}
