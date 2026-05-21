import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { AnimalsController } from './animals.controller.js';
import {
  createAnimalSchema,
  updateAnimalSchema,
  createMedicalRecordSchema,
  animalFilterSchema,
} from './animals.validator.js';

export function configureAnimalsRoutes(router: Router, controller: AnimalsController): void {
  router.post(
    '/',
    createValidationMiddleware(createAnimalSchema),
    controller.create
  );

  router.get(
    '/',
    createValidationMiddleware(animalFilterSchema),
    controller.list
  );

  router.get('/owner/:ownerId', controller.getByOwner);

  router.get('/:id', controller.getById);

  router.patch(
    '/:id',
    createValidationMiddleware(updateAnimalSchema),
    controller.update
  );

  router.delete('/:id', controller.delete);

  router.get('/:id/medical-records', controller.getMedicalRecords);

  router.post(
    '/medical-records',
    createValidationMiddleware(createMedicalRecordSchema),
    controller.addMedicalRecord
  );
}
