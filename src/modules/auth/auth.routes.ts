import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import {
  rateLimitLogin,
  rateLimitOtpRequest,
  rateLimitOtpVerify,
} from '../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';
import { validateBody } from '../../shared/validation/validate.middleware.js';

import type { AuthController } from './auth.controller.js';
import { requestOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.validator.js';

export function configureAuthRoutes(router: Router, controller: AuthController): void {
  router.post(
    '/otp/request',
    whenRateLimitAvailable(rateLimitOtpRequest),
    validateBody(requestOtpSchema),
    asyncHandler(controller.requestOtp),
  );

  router.post(
    '/otp/verify',
    whenRateLimitAvailable(rateLimitOtpVerify),
    validateBody(verifyOtpSchema),
    asyncHandler(controller.verifyOtp),
  );

  router.post(
    '/token/refresh',
    whenRateLimitAvailable(rateLimitLogin),
    validateBody(refreshTokenSchema),
    asyncHandler(controller.refreshToken),
  );

  // Aliases for client contracts (login = OTP verify, refresh = token refresh)
  router.post(
    '/login',
    whenRateLimitAvailable(rateLimitOtpVerify),
    validateBody(verifyOtpSchema),
    asyncHandler(controller.verifyOtp),
  );

  router.post(
    '/refresh',
    whenRateLimitAvailable(rateLimitLogin),
    validateBody(refreshTokenSchema),
    asyncHandler(controller.refreshToken),
  );

  router.post('/logout', asyncHandler(controller.logout));
}
