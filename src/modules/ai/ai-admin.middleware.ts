import type { Request, Response, NextFunction } from 'express';

import { ForbiddenError, UnauthorizedError } from '../../shared/errors/http.errors.js';

/**
 * Blocks unauthenticated access to admin-ai-ops Express routes.
 * Production admin traffic must use legacy `/api/admin/ai-ops/*` (cookie session via BFF).
 */
export function requireInternalAdminAiOps(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = process.env.INTERNAL_ADMIN_AI_OPS_TOKEN?.trim();
  if (!token) {
    throw new ForbiddenError(
      'ADMIN_AI_OPS_DISABLED',
      'Admin AI ops Express routes are disabled. Use /api/admin/ai-ops via admin panel.',
    );
  }

  const header = req.headers['x-internal-admin-token'];
  if (typeof header !== 'string' || header !== token) {
    throw new UnauthorizedError('ADMIN_AI_OPS_UNAUTHORIZED', 'Invalid internal admin token');
  }

  next();
}
