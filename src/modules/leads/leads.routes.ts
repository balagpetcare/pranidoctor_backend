import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { LeadsController } from './leads.controller.js';
import {
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  convertLeadSchema,
  leadFilterSchema,
} from './leads.validator.js';

export function configureLeadsRoutes(router: Router, controller: LeadsController): void {
  router.post(
    '/',
    createValidationMiddleware(createLeadSchema),
    controller.create
  );

  router.get(
    '/',
    createValidationMiddleware(leadFilterSchema),
    controller.list
  );

  router.get('/:id', controller.getById);

  router.patch(
    '/:id',
    createValidationMiddleware(updateLeadSchema),
    controller.update
  );

  router.post(
    '/:id/assign',
    createValidationMiddleware(assignLeadSchema),
    controller.assign
  );

  router.post(
    '/:id/convert',
    createValidationMiddleware(convertLeadSchema),
    controller.convert
  );

  router.get('/:id/activities', controller.getActivities);
}
