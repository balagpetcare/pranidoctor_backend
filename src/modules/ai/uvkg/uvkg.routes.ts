import type { Router } from 'express';

import { asyncHandler } from '../../../shared/middleware/async-handler.js';
import { knowledgeFoundationAdminGuard } from '../knowledge-foundation/knowledge-foundation.controller.js';
import { getUvkgController } from './uvkg.controller.js';

export function configureUvkgAdminRoutes(router: Router): void {
  const c = getUvkgController();
  const guard = [knowledgeFoundationAdminGuard] as const;

  router.get('/uvkg/drift', ...guard, asyncHandler(c.driftReport.bind(c)));
  router.get('/uvkg/analytics', ...guard, asyncHandler(c.analytics.bind(c)));
  router.get('/uvkg/coverage', ...guard, asyncHandler(c.coverage.bind(c)));
  router.get('/uvkg/quality', ...guard, asyncHandler(c.quality.bind(c)));
  router.get('/uvkg/governance', ...guard, asyncHandler(c.governance.bind(c)));
  router.get('/uvkg/benchmarks', ...guard, asyncHandler(c.benchmarks.bind(c)));
  router.post('/uvkg/populate', ...guard, asyncHandler(c.populate.bind(c)));
  router.post('/uvkg/phase4/validate', ...guard, asyncHandler(c.phase4Validate.bind(c)));
  router.post('/uvkg/phase5/validate', ...guard, asyncHandler(c.phase5Validate.bind(c)));
  router.post('/uvkg/sync', ...guard, asyncHandler(c.syncAll.bind(c)));
  router.post('/uvkg/sync/feed', ...guard, asyncHandler(c.syncFeed.bind(c)));
  router.post('/uvkg/sync/medicine', ...guard, asyncHandler(c.syncMedicine.bind(c)));
  router.post('/uvkg/sync/disease', ...guard, asyncHandler(c.syncDisease.bind(c)));
  router.post('/uvkg/sync/repair', ...guard, asyncHandler(c.repairSync.bind(c)));
  router.post('/uvkg/sync/rebuild-staging', ...guard, asyncHandler(c.rebuildStaging.bind(c)));
  router.get('/uvkg/neighbors', ...guard, asyncHandler(c.neighbors.bind(c)));
}
