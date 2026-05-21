import type { Router } from 'express';

import { asyncHandler } from '../../shared/middleware/async-handler.js';

import type { IdentityController } from './identity.controller.js';

export function configureIdentityRoutes(router: Router, controller: IdentityController): void {
  router.get('/capabilities', asyncHandler(controller.getCapabilities.bind(controller)));

  router.get('/session/devices', asyncHandler(controller.listDevices.bind(controller)));

  router.post(
    '/session/devices/:deviceId/revoke',
    asyncHandler(controller.revokeDevice.bind(controller)),
  );

  router.get('/profile/summary', asyncHandler(controller.getProfileSummary.bind(controller)));

  router.get('/user/state', asyncHandler(controller.getUserState.bind(controller)));
}
