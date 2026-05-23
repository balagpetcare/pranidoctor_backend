import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { authenticateMobileCustomer } from '../auth/mobile-express.middleware.js';

import type { OfflineController, SyncController } from './offline-architecture.controller.js';

export function configureSyncRoutes(router: Router, controller: SyncController): void {
  const guard = [authenticateMobileCustomer] as const;

  router.get('/status', ...guard, asyncHandler(controller.status.bind(controller)));
  router.post('/', ...guard, asyncHandler(controller.sync.bind(controller)));
  router.post('/retry', ...guard, asyncHandler(controller.retry.bind(controller)));
}

export function configureOfflineRoutes(router: Router, controller: OfflineController): void {
  const guard = [authenticateMobileCustomer] as const;

  router.get('/queue', ...guard, asyncHandler(controller.queue.bind(controller)));
}
