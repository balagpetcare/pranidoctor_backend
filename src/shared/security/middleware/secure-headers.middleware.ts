import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Additional security headers beyond Helmet defaults. */
export function secureHeadersMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.removeHeader('X-Powered-By');
    next();
  };
}
