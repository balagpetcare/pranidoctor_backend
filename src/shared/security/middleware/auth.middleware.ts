import type { Request, Response, NextFunction } from 'express';

import { setUserId, setTenantId } from '../../context/request-context.js';
import { UnauthorizedError, ForbiddenError } from '../../errors/http.errors.js';
import { logWarn, logDebug } from '../../logger/logger.js';
import type { AuthContext, AuthUser, UserRole } from '../types.js';
import {
  validateAccessToken,
  extractTokenFromHeader,
} from '../jwt/jwt.service.js';
import { getSession, updateSessionActivity } from '../session/session.storage.js';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasMinimumRole,
} from '../rbac/rbac.service.js';
import type { PermissionType } from '../rbac/permissions.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

export interface AuthOptions {
  context: AuthContext;
  optional?: boolean;
  requireMfa?: boolean;
}

export function authenticate(options: AuthOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        if (options.optional) {
          next();
          return;
        }
        throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required');
      }

      const result = await validateAccessToken(token, options.context);

      if (!result.valid || !result.payload) {
        if (result.expired) {
          throw new UnauthorizedError('AUTH_TOKEN_EXPIRED', 'Token has expired');
        }
        throw new UnauthorizedError('AUTH_TOKEN_INVALID', 'Invalid authentication token');
      }

      const session = await getSession(result.payload.sid);

      if (!session) {
        throw new UnauthorizedError('AUTH_SESSION_NOT_FOUND', 'Session not found');
      }

      if (session.revoked) {
        logWarn('Attempted use of revoked session', {
          sessionId: session.id,
          userId: session.userId,
        });
        throw new UnauthorizedError('AUTH_SESSION_REVOKED', 'Session has been revoked');
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedError('AUTH_SESSION_EXPIRED', 'Session has expired');
      }

      if (options.requireMfa && !session.mfaVerified) {
        throw new ForbiddenError('AUTH_MFA_REQUIRED', 'MFA verification required');
      }

      const user: AuthUser = {
        id: result.payload.sub,
        role: result.payload.role,
        sessionId: result.payload.sid,
        ...(result.payload.did !== undefined ? { deviceId: result.payload.did } : {}),
        ...(result.payload.tid !== undefined ? { tenantId: result.payload.tid } : {}),
      };

      req.user = user;
      req.sessionId = session.id;

      setUserId(user.id);
      if (user.tenantId) {
        setTenantId(user.tenantId);
      }

      updateSessionActivity(session.id).catch(() => {});

      logDebug('User authenticated', {
        userId: user.id,
        role: user.role,
        sessionId: user.sessionId,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(...permissions: PermissionType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('AUTH_REQUIRED', 'Authentication required'));
      return;
    }

    if (!hasAllPermissions(req.user, permissions)) {
      logWarn('Permission denied', {
        userId: req.user.id,
        required: permissions,
        role: req.user.role,
      });
      next(new ForbiddenError('PERMISSION_DENIED', 'Insufficient permissions'));
      return;
    }

    next();
  };
}

export function requireAnyPermission(...permissions: PermissionType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('AUTH_REQUIRED', 'Authentication required'));
      return;
    }

    if (!hasAnyPermission(req.user, permissions)) {
      logWarn('Permission denied', {
        userId: req.user.id,
        required: permissions,
        role: req.user.role,
      });
      next(new ForbiddenError('PERMISSION_DENIED', 'Insufficient permissions'));
      return;
    }

    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('AUTH_REQUIRED', 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      logWarn('Role denied', {
        userId: req.user.id,
        required: roles,
        actual: req.user.role,
      });
      next(new ForbiddenError('ROLE_DENIED', 'Role not authorized'));
      return;
    }

    next();
  };
}

export function requireMinimumRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('AUTH_REQUIRED', 'Authentication required'));
      return;
    }

    if (!hasMinimumRole(req.user, minimumRole)) {
      logWarn('Role level denied', {
        userId: req.user.id,
        required: minimumRole,
        actual: req.user.role,
      });
      next(new ForbiddenError('ROLE_LEVEL_DENIED', 'Higher role level required'));
      return;
    }

    next();
  };
}

export function requireOwnershipOrPermission(
  getResourceOwnerId: (req: Request) => string | undefined,
  permission: PermissionType
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('AUTH_REQUIRED', 'Authentication required'));
      return;
    }

    const ownerId = getResourceOwnerId(req);

    if (ownerId && req.user.id === ownerId) {
      next();
      return;
    }

    if (hasPermission(req.user, permission)) {
      next();
      return;
    }

    logWarn('Ownership or permission denied', {
      userId: req.user.id,
      ownerId,
      permission,
    });
    next(new ForbiddenError('ACCESS_DENIED', 'Access denied'));
  };
}

export const authMobile = authenticate({ context: 'mobile' });
export const authAdmin = authenticate({ context: 'admin' });
export const authDoctor = authenticate({ context: 'doctor' });
export const authTechnician = authenticate({ context: 'technician' });
export const authApi = authenticate({ context: 'api' });

export const optionalAuthMobile = authenticate({ context: 'mobile', optional: true });
export const optionalAuthAdmin = authenticate({ context: 'admin', optional: true });

export const mfaRequired = authenticate({ context: 'mobile', requireMfa: true });
