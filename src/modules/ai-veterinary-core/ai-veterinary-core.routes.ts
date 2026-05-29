import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authenticateMobileCustomer } from '../auth/mobile-express.middleware.js';
import { requireMobileAiConsent } from '../auth/mobile-legal-consent.middleware.js';
import { rateLimitAiChat } from '../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';

import type { AiVeterinaryCoreController } from './ai-veterinary-core.controller.js';

export function configureAiVeterinaryCoreRoutes(
  router: Router,
  controller: AiVeterinaryCoreController,
): void {
  const guard = [authenticateMobileCustomer, requireMobileAiConsent] as const;
  const aiChatLimit = whenRateLimitAvailable(rateLimitAiChat);

  router.post('/chat', ...guard, aiChatLimit, asyncHandler(controller.chat.bind(controller)));
  router.post('/triage', ...guard, aiChatLimit, asyncHandler(controller.triage.bind(controller)));
  router.get('/history', ...guard, asyncHandler(controller.history.bind(controller)));
  router.get('/memory', ...guard, asyncHandler(controller.listMemory.bind(controller)));
  router.delete('/memory', ...guard, asyncHandler(controller.deleteMemory.bind(controller)));
  router.post('/escalate', ...guard, asyncHandler(controller.escalate.bind(controller)));
}
