import type { Router } from 'express';

import type { LivestockController } from './livestock.controller.js';

/**
 * Foundation route wiring hook. Mobile HTTP handlers mount under legacy/web;
 * auth is applied at the route adapter layer, not here.
 */
export function configureLivestockRoutes(
  _router: Router,
  _controller: LivestockController,
): void {
  // Reserved for future in-process Express mounts.
}

export const LIVESTOCK_ROUTE_PATHS = {
  root: '/',
  byId: '/:id',
  images: '/:id/images',
  imageById: '/:id/images/:imageId',
} as const;
