import type { Router } from 'express';

import {
  authMobile,
  rateLimitSearch,
  rateLimitStrict,
  whenRateLimitAvailable,
} from '../../shared/security/index.js';

import { configureDiscoveryAdminRoutes } from './discovery.admin.js';
import { configureOfferingRoutes } from './discovery.offerings.js';
import type { DiscoveryController } from './discovery.controller.js';

export function configureDiscoveryRoutes(router: Router, controller: DiscoveryController): void {
  // Public browsing (works before login) — protected by IP rate limits and short caches.
  router.get('/hub', whenRateLimitAvailable(rateLimitSearch), controller.hub);
  router.get('/providers', whenRateLimitAvailable(rateLimitSearch), controller.list);
  router.get('/providers/:kind/:id', whenRateLimitAvailable(rateLimitSearch), controller.detail);

  // Providers only (enforced against the database in the service). Heartbeat-friendly limit.
  router.put('/presence', authMobile, whenRateLimitAvailable(rateLimitStrict), controller.presence);

  configureOfferingRoutes(router);
  configureDiscoveryAdminRoutes(router);
}
