import type { Router } from 'express';

import { createValidationMiddleware } from '../auth/validation.middleware.js';

import type { AiController } from './ai.controller.js';
import {
  startConversationSchema,
  chatRequestSchema,
  conversationFilterSchema,
} from './ai.validator.js';

export function configureAiRoutes(router: Router, controller: AiController): void {
  router.post(
    '/conversations',
    createValidationMiddleware(startConversationSchema),
    controller.startConversation
  );

  router.post(
    '/chat',
    createValidationMiddleware(chatRequestSchema),
    controller.chat
  );

  router.get(
    '/conversations',
    createValidationMiddleware(conversationFilterSchema),
    controller.listConversations
  );

  router.get('/conversations/:id', controller.getConversation);

  router.post('/conversations/:id/end', controller.endConversation);

  router.get('/conversations/:id/messages', controller.getMessages);
}
