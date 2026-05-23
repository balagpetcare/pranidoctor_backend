import type { Request, Response, NextFunction } from 'express';

import { setUserId } from '../../shared/context/request-context.js';
import { UnauthorizedError } from '../../shared/errors/http.errors.js';
import { logDebug, logWarn } from '../../shared/logger/logger.js';
import {
  extractTokenFromHeader,
  validateAccessToken,
} from '../../shared/security/jwt/jwt.service.js';
import { getSession, updateSessionActivity } from '../../shared/security/session/session.storage.js';
import type { AuthUser } from '../../shared/security/types.js';

import { AUTH_CHANNELS } from './identity-core.js';
import { assertJwtSessionActive, touchJwtSession } from './session-guard.helper.js';
import { verifyMobileJwt } from './tokens/mobile-jwt.js';

/**
 * Authenticates mobile customer requests for foundation Express modules
 * (`/api/sync`, `/api/ai`, `/api/voice`, `/api/offline`).
 *
 * OTP/mobile tokens are issued via `signMobileCustomerToken` (aud `mobile-app`,
 * Prisma session). Legacy foundation `authMobile` expected Redis sessions and
 * different claim shape — this middleware unifies both.
 */
export async function authenticateMobileCustomer(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required');
    }

    const foundation = await validateAccessToken(token, 'mobile');
    if (foundation.valid && foundation.payload?.sid) {
      const session = await getSession(foundation.payload.sid);
      if (session && !session.revoked) {
        req.user = {
          id: foundation.payload.sub,
          role: foundation.payload.role,
          sessionId: foundation.payload.sid,
          ...(foundation.payload.did !== undefined
            ? { deviceId: foundation.payload.did }
            : {}),
        };
        req.sessionId = foundation.payload.sid;
        setUserId(req.user.id);
        updateSessionActivity(session.id).catch(() => {});
        logDebug('[AUTH] mobile foundation session ok', { userId: req.user.id });
        next();
        return;
      }
    }

    const payload = await verifyMobileJwt(token);
    if (!payload) {
      logWarn('[AUTH] mobile JWT verify failed', {
        reason: 'invalid_signature_or_claims',
      });
      throw new UnauthorizedError('AUTH_TOKEN_INVALID', 'Invalid authentication token');
    }

    const guard = await assertJwtSessionActive(payload, AUTH_CHANNELS.mobile);
    if (guard === 'revoked') {
      throw new UnauthorizedError('AUTH_SESSION_REVOKED', 'Session has been revoked');
    }

    const sessionId = payload.sid ?? '';
    req.user = {
      id: payload.sub,
      role: 'USER',
      sessionId,
    };
    req.sessionId = sessionId;
    setUserId(payload.sub);
    await touchJwtSession(payload);
    logDebug('[AUTH] mobile compat session ok', { userId: payload.sub });
    next();
  } catch (error) {
    next(error);
  }
}
