import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authenticateMobileCustomer } from '../auth/mobile-express.middleware.js';
import {
  requireMobileAiConsent,
} from '../auth/mobile-legal-consent.middleware.js';
import {
  rateLimitAiChat,
  rateLimitSearch,
  rateLimitStrict,
} from '../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';
import { requireInternalAdminAiOps } from './ai-admin.middleware.js';
import { configureAiVeterinaryCoreRoutes } from '../ai-veterinary-core/ai-veterinary-core.routes.js';
import type { AiVeterinaryCoreController } from '../ai-veterinary-core/ai-veterinary-core.controller.js';

import type { AiAdminController, AiController } from './ai.controller.js';
import { aiGovernanceRouteObserver } from './governance/ai-governance.middleware.js';

export function configureAiRoutes(router: Router, controller: AiController): void {
  router.use(aiGovernanceRouteObserver);

  configureAiVeterinaryCoreRoutes(router, controller as unknown as AiVeterinaryCoreController);

  const guard = [authenticateMobileCustomer, requireMobileAiConsent] as const;
  const aiChatLimit = whenRateLimitAvailable(rateLimitAiChat);
  const aiReadLimit = whenRateLimitAvailable(rateLimitStrict);
  const searchLimit = whenRateLimitAvailable(rateLimitSearch);

  router.post('/chat/v2', ...guard, aiChatLimit, asyncHandler(controller.chatEnhanced.bind(controller)));
  router.get('/symptom-taxonomy', ...guard, asyncHandler(controller.symptomTaxonomy.bind(controller)));
  router.post('/symptom-check', ...guard, aiChatLimit, asyncHandler(controller.symptomCheck.bind(controller)));
  router.get('/knowledge/search', ...guard, searchLimit, asyncHandler(controller.knowledgeSearch.bind(controller)));
  router.get('/knowledge/:slug', ...guard, asyncHandler(controller.knowledgeGet.bind(controller)));
  router.get('/smart-recommendations', ...guard, aiReadLimit, asyncHandler(controller.smartRecommendations.bind(controller)));
  router.post('/smart-recommendations/:id/dismiss', ...guard, asyncHandler(controller.dismissRecommendation.bind(controller)));
  router.post('/smart-recommendations/:id/complete', ...guard, asyncHandler(controller.completeRecommendation.bind(controller)));
  router.get('/smart-alerts', ...guard, aiReadLimit, asyncHandler(controller.smartAlerts.bind(controller)));
  router.post('/smart-alerts/:id/dismiss', ...guard, asyncHandler(controller.dismissAlert.bind(controller)));
  router.get('/farm-health', ...guard, aiReadLimit, asyncHandler(controller.farmHealthDashboard.bind(controller)));
  router.post('/briefing/daily', ...guard, aiChatLimit, asyncHandler(controller.farmBriefing.bind(controller)));
  router.post('/farm-query', ...guard, aiChatLimit, asyncHandler(controller.farmQuery.bind(controller)));
  router.get('/follow-ups', ...guard, asyncHandler(controller.followUps.bind(controller)));
  router.post('/follow-ups/:id/dismiss', ...guard, asyncHandler(controller.dismissFollowUp.bind(controller)));
  router.get('/analytics/farm-risk', ...guard, asyncHandler(controller.mobileAnalytics.bind(controller)));
}

export function configureAiAdminRoutes(router: Router, admin: AiAdminController): void {
  const guard = [requireInternalAdminAiOps] as const;

  router.get('/overview', ...guard, asyncHandler(admin.overview.bind(admin)));
  router.get('/usage/users/:userId', ...guard, asyncHandler(admin.userTokenUsage.bind(admin)));
  router.get('/usage/customers/:customerId', ...guard, asyncHandler(admin.customerTokenUsage.bind(admin)));
  router.get('/analytics/risk', ...guard, asyncHandler(admin.riskMonitoring.bind(admin)));
  router.get('/knowledge', ...guard, asyncHandler(admin.listKnowledge.bind(admin)));
  router.post('/knowledge', ...guard, asyncHandler(admin.createKnowledge.bind(admin)));
  router.post('/knowledge/:id/publish', ...guard, asyncHandler(admin.publishKnowledge.bind(admin)));
  router.get('/prompts', ...guard, asyncHandler(admin.listPrompts.bind(admin)));
  router.post('/prompts', ...guard, asyncHandler(admin.createPrompt.bind(admin)));
  router.post('/prompts/:id/activate', ...guard, asyncHandler(admin.activatePrompt.bind(admin)));
  router.get('/escalations', ...guard, asyncHandler(admin.listEscalations.bind(admin)));
  router.get('/audit', ...guard, asyncHandler(admin.auditLog.bind(admin)));
  router.post('/kill-switch', ...guard, asyncHandler(admin.killSwitch.bind(admin)));
}
