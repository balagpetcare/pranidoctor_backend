import type { Request } from 'express';

import { verifyMobileJwt } from '../auth/tokens/mobile-jwt.js';

/** Resolve mobile customer user id from Bearer JWT (additive identity routes). */
export async function resolveMobileBearerUserId(req: Request): Promise<string | null> {
  const ext = req as Request & { userId?: string };
  if (typeof ext.userId === 'string' && ext.userId.length > 0) {
    return ext.userId;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();
  if (!token) {
    return null;
  }

  const payload = await verifyMobileJwt(token);
  return payload?.sub ?? null;
}
