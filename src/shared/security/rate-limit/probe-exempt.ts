import type { Request, Response, NextFunction, RequestHandler } from 'express';

const PROBE_PATHS = new Set(['/health', '/ready', '/live', '/metrics', '/metrics/json']);

function isProbeRequest(req: Request): boolean {
  const path = req.path;
  if (PROBE_PATHS.has(path)) return true;
  if (path.startsWith('/health/')) return true;
  return false;
}

/** Skips rate limiting for health/readiness/metrics probes. */
export function rateLimitUnlessProbe(middleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isProbeRequest(req)) {
      next();
      return;
    }
    middleware(req, res, next);
  };
}
