import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authenticateMobileCustomer } from '../auth/mobile-express.middleware.js';
import { rateLimitAiChat } from '../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';

import type { VoiceAssistantController } from './voice-assistant.controller.js';

export function configureVoiceAssistantRoutes(
  router: Router,
  controller: VoiceAssistantController,
): void {
  const guard = [authenticateMobileCustomer] as const;
  const aiChatLimit = whenRateLimitAvailable(rateLimitAiChat);

  router.post('/stt', ...guard, asyncHandler(controller.stt.bind(controller)));
  router.post('/chat', ...guard, aiChatLimit, asyncHandler(controller.chat.bind(controller)));
  router.post('/navigation', ...guard, asyncHandler(controller.navigation.bind(controller)));
  router.get('/session', ...guard, asyncHandler(controller.getSession.bind(controller)));
}
