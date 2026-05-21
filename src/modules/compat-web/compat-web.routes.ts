import { Router } from 'express';

import { getLogger } from '../../shared/logger/logger.js';

import { registerLegacyWebRoutes } from './route-registry.js';

let registered = 0;

export async function createCompatWebRouter(): Promise<Router> {
  const router = Router();
  router.get('/ping', (_req, res) => {
    res.json({ ok: true, scope: 'compat-web' });
  });
  registered = await registerLegacyWebRoutes(router);
  getLogger().info({ msg: 'Compat web API routes registered', count: registered });
  return router;
}

export function getCompatRouteCount(): number {
  return registered;
}
