import type { Request, Response, NextFunction, RequestHandler } from 'express';

import { isProduction } from '../../config/config.loader.js';

/**
 * Protects OpenAPI/Swagger in production/staging when API_DOCS_KEY is set.
 * Pass `X-API-Docs-Key` header or `?key=` query matching the env value.
 */
export function createDocsAuthMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const expected = process.env['API_DOCS_KEY']?.trim();
    if (!expected) {
      if (isProduction()) {
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
      next();
      return;
    }

    const provided =
      (typeof req.headers['x-api-docs-key'] === 'string'
        ? req.headers['x-api-docs-key']
        : undefined) ??
      (typeof req.query['key'] === 'string' ? req.query['key'] : undefined);

    if (provided !== expected) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    next();
  };
}
