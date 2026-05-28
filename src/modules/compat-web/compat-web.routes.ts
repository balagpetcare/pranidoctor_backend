import { Router } from 'express';

import { getLogger } from '../../shared/logger/logger.js';
import {
  rateLimitLogin,
  rateLimitOtpRequest,
  rateLimitOtpVerify,
} from '../../shared/security/rate-limit/rate-limit.service.js';
import { createCompatAuthRateLimitMiddleware } from '../../shared/security/rate-limit/safe-rate-limit.js';

import { registerLegacyWebRoutes } from './route-registry.js';

let registered = 0;

export async function createCompatWebRouter(): Promise<Router> {
  const router = Router();

  router.use(
    createCompatAuthRateLimitMiddleware({
      otpRequest: rateLimitOtpRequest,
      otpVerify: rateLimitOtpVerify,
      login: rateLimitLogin,
    }),
  );

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
