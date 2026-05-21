import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';

import type { AuthController } from './auth.controller.js';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.validator.js';
import { createValidationMiddleware } from './validation.middleware.js';

export function configureAuthRoutes(router: Router, controller: AuthController): void {
  router.post(
    '/otp/request',
    createValidationMiddleware(requestOtpSchema),
    asyncHandler(controller.requestOtp),
  );

  router.post(
    '/otp/verify',
    createValidationMiddleware(verifyOtpSchema),
    asyncHandler(controller.verifyOtp),
  );

  router.post(
    '/token/refresh',
    createValidationMiddleware(refreshTokenSchema),
    asyncHandler(controller.refreshToken),
  );

  // Aliases for client contracts (login = OTP verify, refresh = token refresh)
  router.post(
    '/login',
    createValidationMiddleware(verifyOtpSchema),
    asyncHandler(controller.verifyOtp),
  );

  router.post(
    '/refresh',
    createValidationMiddleware(refreshTokenSchema),
    asyncHandler(controller.refreshToken),
  );

  router.post('/logout', asyncHandler(controller.logout));
}
