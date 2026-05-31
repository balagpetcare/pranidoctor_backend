import type { Router } from 'express';

import { asyncHandler } from '../../../shared/middleware/async-handler.js';
import { authenticateMobileCustomer } from '../../auth/mobile-express.middleware.js';
import { requireMobileAiConsent } from '../../auth/mobile-legal-consent.middleware.js';
import {
  rateLimitAiChat,
  rateLimitSearch,
  rateLimitStrict,
} from '../../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../../shared/security/rate-limit/safe-rate-limit.js';
import { requireInternalAdminAiOps } from '../ai-admin.middleware.js';
import type { DiseaseIntelligenceController } from './disease-intelligence.controller.js';

export function configureDiseaseIntelligenceRoutes(
  router: Router,
  controller: DiseaseIntelligenceController,
): void {
  const guard = [authenticateMobileCustomer, requireMobileAiConsent] as const;
  const readLimit = whenRateLimitAvailable(rateLimitStrict);
  const chatLimit = whenRateLimitAvailable(rateLimitAiChat);
  const searchLimit = whenRateLimitAvailable(rateLimitSearch);

  router.get('/disease/registry', ...guard, readLimit, asyncHandler(controller.searchRegistry.bind(controller)));
  router.get('/disease/registry/:code', ...guard, readLimit, asyncHandler(controller.getRegistry.bind(controller)));
  router.get('/disease/graph/neighbors', ...guard, readLimit, asyncHandler(controller.graphNeighbors.bind(controller)));
  router.get('/disease/symptoms', ...guard, readLimit, asyncHandler(controller.symptomTaxonomy.bind(controller)));
  router.post('/disease/symptoms/resolve', ...guard, searchLimit, asyncHandler(controller.resolveSymptoms.bind(controller)));
  router.post('/disease/differential/compute', ...guard, chatLimit, asyncHandler(controller.computeDifferential.bind(controller)));
  router.post('/disease/safety/evaluate', ...guard, chatLimit, asyncHandler(controller.evaluateSafety.bind(controller)));
  router.get('/disease/outbreak/map', ...guard, readLimit, asyncHandler(controller.outbreakMap.bind(controller)));
  router.post('/disease/outbreak/subscribe', ...guard, asyncHandler(controller.subscribeOutbreak.bind(controller)));
}

export function configureDiseaseIntelligenceAdminRoutes(
  router: Router,
  controller: DiseaseIntelligenceController,
): void {
  const guard = [requireInternalAdminAiOps] as const;

  router.get('/disease/analytics/overview', ...guard, asyncHandler(controller.adminAnalyticsOverview.bind(controller)));
  router.post('/disease/registry', ...guard, asyncHandler(controller.adminCreateRegistry.bind(controller)));
  router.post('/disease/outbreak/signals', ...guard, asyncHandler(controller.adminIngestOutbreak.bind(controller)));
  router.post('/disease/migrate-legacy', ...guard, asyncHandler(controller.adminMigrateLegacy.bind(controller)));
}

/** Vet APIs — authenticated; vetId must match session user (IDOR guard in controller). */
export function configureDiseaseVetRoutes(router: Router, controller: DiseaseIntelligenceController): void {
  const guard = [authenticateMobileCustomer, requireMobileAiConsent] as const;
  router.get('/vet/disease/queue', ...guard, asyncHandler(controller.vetQueue.bind(controller)));
  router.post('/vet/disease/validate', ...guard, asyncHandler(controller.vetValidate.bind(controller)));
}
