import type { Router } from 'express';

import { asyncHandler } from '../../../shared/middleware/async-handler.js';
import {
  getKnowledgeImportController,
  knowledgeImportAdminGuard,
} from './knowledge-import.controller.js';

export function configureKnowledgeImportAdminRoutes(router: Router): void {
  const c = getKnowledgeImportController();
  const guard = [knowledgeImportAdminGuard] as const;

  router.get('/import/profiles', ...guard, asyncHandler(c.listProfiles.bind(c)));
  router.post('/import/runs', ...guard, asyncHandler(c.startImport.bind(c)));
  router.get('/import/runs', ...guard, asyncHandler(c.listImportRuns.bind(c)));
  router.get('/import/runs/:importRunId', ...guard, asyncHandler(c.getImportRun.bind(c)));
}
