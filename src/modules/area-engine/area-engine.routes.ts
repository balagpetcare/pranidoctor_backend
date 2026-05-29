import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { rateLimitSearch } from '../../shared/security/rate-limit/rate-limit.service.js';
import { whenRateLimitAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';

import type { AreaEngineController } from './area-engine.controller.js';

export function configureAreaEngineRoutes(
  router: Router,
  controller: AreaEngineController,
): void {
  router.get('/divisions', asyncHandler(controller.getDivisions.bind(controller)));

  router.get(
    '/divisions/:id/districts',
    asyncHandler(controller.getDistricts.bind(controller)),
  );

  router.get(
    '/districts/:id/upazilas',
    asyncHandler(controller.getUpazilas.bind(controller)),
  );

  router.get('/upazilas/:id/unions', asyncHandler(controller.getUnions.bind(controller)));

  router.get('/unions/:id/villages', asyncHandler(controller.getVillages.bind(controller)));

  router.get('/search', whenRateLimitAvailable(rateLimitSearch), asyncHandler(controller.search.bind(controller)));

  router.get('/seed/version', asyncHandler(controller.getSeedVersion.bind(controller)));
}
