import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authMobile } from '../../shared/security/middleware/auth.middleware.js';

import type { VoiceAssistantController } from './voice-assistant.controller.js';

export function configureVoiceAssistantRoutes(
  router: Router,
  controller: VoiceAssistantController,
): void {
  const guard = [authMobile] as const;

  router.post('/stt', ...guard, asyncHandler(controller.stt.bind(controller)));
  router.post('/chat', ...guard, asyncHandler(controller.chat.bind(controller)));
  router.post('/navigation', ...guard, asyncHandler(controller.navigation.bind(controller)));
  router.get('/session', ...guard, asyncHandler(controller.getSession.bind(controller)));
}
