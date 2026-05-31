import type { Router } from 'express';

import { asyncHandler } from '../../../shared/middleware/async-handler.js';
import {
  getKnowledgeFoundationController,
  knowledgeFoundationAdminGuard,
} from './knowledge-foundation.controller.js';

export function configureKnowledgeFoundationAdminRoutes(router: Router): void {
  const c = getKnowledgeFoundationController();
  const guard = [knowledgeFoundationAdminGuard] as const;

  router.get('/foundation/sources', ...guard, asyncHandler(c.listSources.bind(c)));
  router.post('/foundation/sources', ...guard, asyncHandler(c.createSource.bind(c)));

  router.get('/foundation/entities', ...guard, asyncHandler(c.listEntities.bind(c)));
  router.post('/foundation/entities', ...guard, asyncHandler(c.createEntity.bind(c)));
  router.get('/foundation/entities/:id', ...guard, asyncHandler(c.getEntity.bind(c)));

  router.get('/foundation/versions/:versionId', ...guard, asyncHandler(c.getVersion.bind(c)));
  router.patch('/foundation/versions/:versionId', ...guard, asyncHandler(c.updateVersion.bind(c)));
  router.post('/foundation/versions/:versionId/submit', ...guard, asyncHandler(c.submitVersion.bind(c)));
  router.post('/foundation/versions/:versionId/fork', ...guard, asyncHandler(c.forkVersion.bind(c)));
  router.post('/foundation/versions/:versionId/publish', ...guard, asyncHandler(c.publishVersion.bind(c)));
  router.post('/foundation/versions/:versionId/archive', ...guard, asyncHandler(c.archiveVersion.bind(c)));
  router.get('/foundation/versions/:versionId/governance-stage', ...guard, asyncHandler(c.governanceStage.bind(c)));

  router.get('/foundation/versions/:versionId/citations', ...guard, asyncHandler(c.listCitations.bind(c)));
  router.post('/foundation/versions/:versionId/citations', ...guard, asyncHandler(c.addCitation.bind(c)));
  router.delete('/foundation/citations/:citationId', ...guard, asyncHandler(c.removeCitation.bind(c)));

  router.get('/foundation/review-queue', ...guard, asyncHandler(c.editorialQueue.bind(c)));
  router.get('/foundation/approval-queue', ...guard, asyncHandler(c.approvalQueue.bind(c)));
  router.post('/foundation/reviews/complete', ...guard, asyncHandler(c.completeReview.bind(c)));

  router.get('/foundation/vet-queue', ...guard, asyncHandler(c.vetQueue.bind(c)));
  router.post('/foundation/approvals', ...guard, asyncHandler(c.recordApproval.bind(c)));

  router.get('/foundation/audit', ...guard, asyncHandler(c.listAudit.bind(c)));
}
