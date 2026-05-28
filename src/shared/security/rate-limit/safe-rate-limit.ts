import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { isRedisInitialized } from '../../../infra/redis/redis.client.js';
import { getConfig } from '../../config/index.js';
import { isRedisEnabled } from '../../config/infra.flags.js';
import { logWarn } from '../../logger/logger.js';

export function isRateLimitingAvailable(): boolean {
  try {
    const config = getConfig();
    return isRedisEnabled(config) && isRedisInitialized();
  } catch {
    return false;
  }
}

/** Applies rate limit middleware when Redis is up; otherwise passes through (dev without Redis). */
export function whenRateLimitAvailable(middleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isRateLimitingAvailable()) {
      next();
      return;
    }
    void Promise.resolve(middleware(req, res, next)).catch(next);
  };
}

export interface CompatAuthRateLimiters {
  otpRequest: RequestHandler;
  otpVerify: RequestHandler;
  login: RequestHandler;
}

/** Rate limits for compat auth paths (mounted on `/api` router). */
export function createCompatAuthRateLimitMiddleware(
  rateLimiters: CompatAuthRateLimiters,
): RequestHandler {
  const routes: { method: string; path: string; limiter: RequestHandler }[] = [
    { method: 'POST', path: '/mobile/auth/otp/request', limiter: rateLimiters.otpRequest },
    { method: 'POST', path: '/mobile/auth/verify-otp', limiter: rateLimiters.otpVerify },
    { method: 'POST', path: '/mobile/auth/login', limiter: rateLimiters.otpVerify },
    { method: 'POST', path: '/mobile/auth/refresh', limiter: rateLimiters.login },
    { method: 'POST', path: '/admin/auth/login', limiter: rateLimiters.login },
    { method: 'POST', path: '/doctor/auth/login', limiter: rateLimiters.login },
    { method: 'POST', path: '/technician/auth/login', limiter: rateLimiters.login },
  ];

  return (req: Request, res: Response, next: NextFunction): void => {
    const match = routes.find((r) => r.method === req.method && req.path === r.path);
    if (!match) {
      next();
      return;
    }
    whenRateLimitAvailable(match.limiter)(req, res, next);
  };
}

export function whenRateLimitUnavailableWarn(context: string): void {
  if (!isRateLimitingAvailable()) {
    logWarn('Rate limiting skipped — Redis unavailable', { context });
  }
}
