import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { ClinicsController } from './clinics.controller.js';
import {
  createClinicSchema,
  updateClinicSchema,
  createClinicServiceSchema,
  addStaffSchema,
  clinicFilterSchema,
} from './clinics.validator.js';

export function configureClinicsRoutes(router: Router, controller: ClinicsController): void {
  router.post(
    '/',
    createValidationMiddleware(createClinicSchema),
    controller.create
  );

  router.get(
    '/',
    createValidationMiddleware(clinicFilterSchema),
    controller.list
  );

  router.get('/slug/:slug', controller.getBySlug);

  router.get('/:id', controller.getById);

  router.patch(
    '/:id',
    createValidationMiddleware(updateClinicSchema),
    controller.update
  );

  router.get('/:id/services', controller.getServices);

  router.post(
    '/services',
    createValidationMiddleware(createClinicServiceSchema),
    controller.addService
  );

  router.delete('/services/:serviceId', controller.removeService);

  router.get('/:id/staff', controller.getStaff);

  router.post(
    '/staff',
    createValidationMiddleware(addStaffSchema),
    controller.addStaff
  );

  router.delete('/staff/:staffId', controller.removeStaff);
}
