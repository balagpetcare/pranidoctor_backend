import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authMobile } from '../../shared/security/middleware/auth.middleware.js';

import type { AiVeterinaryCoreController } from './ai-veterinary-core.controller.js';

export function configureAiVeterinaryCoreRoutes(
  router: Router,
  controller: AiVeterinaryCoreController,
): void {
  const guard = [authMobile] as const;

  router.post('/chat', ...guard, asyncHandler(controller.chat.bind(controller)));
  router.post('/triage', ...guard, asyncHandler(controller.triage.bind(controller)));
  router.get('/memory', ...guard, asyncHandler(controller.listMemory.bind(controller)));
  router.delete('/memory', ...guard, asyncHandler(controller.deleteMemory.bind(controller)));
  router.post('/escalate', ...guard, asyncHandler(controller.escalate.bind(controller)));
}
