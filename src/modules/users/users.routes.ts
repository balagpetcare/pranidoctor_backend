import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { UsersController } from './users.controller.js';
import { updateUserSchema, updateUserProfileSchema, userFilterSchema } from './users.validator.js';

export function configureUsersRoutes(router: Router, controller: UsersController): void {
  router.get('/me', controller.getMe);

  router.get('/me/profile', controller.getProfile);

  router.patch(
    '/me/profile',
    createValidationMiddleware(updateUserProfileSchema),
    controller.updateProfile
  );

  router.get(
    '/',
    createValidationMiddleware(userFilterSchema),
    controller.list
  );

  router.get('/:id', controller.getById);

  router.patch(
    '/:id',
    createValidationMiddleware(updateUserSchema),
    controller.update
  );
}
