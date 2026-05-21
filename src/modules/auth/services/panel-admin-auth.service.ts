import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { AuthAuditAction, Prisma, UserRole, UserStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import {
  authRequestContext,
  recordAuthAuditFireAndForget,
} from '../auth-audit.service.js';
import { recordPanelSession } from '../mobile-auth-credentials.service.js';
import { revokePanelSession } from '../panel-session.helper.js';
import { isPanelJwtSidEnabled } from '../session-guard.config.js';
import { AUTH_CHANNELS, normalizeBdMobilePhone } from '../identity-core.js';
import type { AdminPanelActor } from '../permissions.registry.js';
import {
  isAdminLoginDatabaseConnectivityError,
  logAdminLoginFailure,
  type AdminLoginErrorCode,
} from '../../../legacy/web/lib/admin-auth/admin-login-errors.js';
import {
  getAdminJwtSecret,
  signAdminToken,
  type AdminJwtPayload,
  type AdminPanelSessionRole,
} from '../tokens/panel-admin-token.js';

const loginBodySchema = z.object({
  email: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().min(1),
});

export type AdminLoginBody = z.infer<typeof loginBodySchema>;

export function parseAdminLoginBody(json: unknown):
  | { ok: true; data: AdminLoginBody }
  | { ok: false; code: AdminLoginErrorCode; message: string; status: number; details?: unknown } {
  const parsed = loginBodySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'server_error',
      message: 'Invalid email or password payload',
      status: 422,
      details: parsed.error.flatten(),
    };
  }
  return { ok: true, data: parsed.data };
}

function resolveLoginIdentifier(data: AdminLoginBody): string {
  return data.email?.trim() || data.identifier?.trim() || '';
}

function buildAdminUserWhere(loginId: string): Prisma.UserWhereInput {
  const id = loginId.trim();
  if (id.includes('@')) {
    return { email: { equals: id, mode: 'insensitive' } };
  }
  const normalized = normalizeBdMobilePhone(id);
  const phones = new Set<string>();
  if (normalized) phones.add(normalized);
  phones.add(id);
  return { OR: [...phones].map((phone) => ({ phone })) };
}

export type AdminLoginSuccess = {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    name: string;
    role: AdminPanelSessionRole;
  };
};

export type AdminLoginFailure = {
  code: AdminLoginErrorCode | 'server_error';
  message: string;
  status: number;
  details?: unknown;
};

export class PanelAdminAuthService {
  async login(
    body: AdminLoginBody,
    request?: Request,
  ): Promise<{ ok: true; value: AdminLoginSuccess } | { ok: false; error: AdminLoginFailure }> {
    const ctx = authRequestContext(request);
    const loginId = resolveLoginIdentifier(body);
    if (!loginId) {
      logAdminLoginFailure('server_error');
      return {
        ok: false,
        error: {
          code: 'server_error',
          message: 'Invalid email or password payload',
          status: 422,
        },
      };
    }

    if (loginId.includes('@')) {
      const emailOk = z.string().email().safeParse(loginId);
      if (!emailOk.success) {
        logAdminLoginFailure('server_error');
        return {
          ok: false,
          error: {
            code: 'server_error',
            message: 'Invalid email or password payload',
            status: 422,
            details: emailOk.error.flatten(),
          },
        };
      }
    }

    if (!getAdminJwtSecret()) {
      logAdminLoginFailure('server_error');
      return {
        ok: false,
        error: {
          code: 'server_error',
          message: 'Admin session signing is not configured on the server',
          status: 500,
        },
      };
    }

    const prisma = getPrisma();
    let user;
    try {
      user = await prisma.user.findFirst({
        where: buildAdminUserWhere(loginId),
        include: { adminProfile: true },
      });
    } catch (e: unknown) {
      if (isAdminLoginDatabaseConnectivityError(e)) {
        const prismaCode =
          e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
        logAdminLoginFailure('db_unavailable', prismaCode ? { prismaCode } : undefined);
        return {
          ok: false,
          error: {
            code: 'db_unavailable',
            message: 'Could not reach the database',
            status: 503,
          },
        };
      }
      const prismaCode =
        e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
      logAdminLoginFailure('server_error', prismaCode ? { prismaCode } : undefined);
      return {
        ok: false,
        error: {
          code: 'server_error',
          message: 'Unexpected error during sign-in',
          status: 500,
        },
      };
    }

    const isPanelAdmin =
      user &&
      (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) &&
      user.status === UserStatus.ACTIVE &&
      user.adminProfile;

    if (!isPanelAdmin || !user) {
      logAdminLoginFailure('invalid_credentials');
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.LOGIN_FAILURE,
        channel: AUTH_CHANNELS.adminPanel,
        ...ctx,
        metadata: { code: 'invalid_credentials' },
      });
      return {
        ok: false,
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password',
          status: 401,
        },
      };
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      logAdminLoginFailure('invalid_credentials');
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.LOGIN_FAILURE,
        channel: AUTH_CHANNELS.adminPanel,
        userId: user.id,
        role: user.role,
        ...ctx,
        metadata: { code: 'invalid_credentials' },
      });
      return {
        ok: false,
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password',
          status: 401,
        },
      };
    }

    const sessionRole: AdminPanelSessionRole =
      user.role === UserRole.SUPER_ADMIN ? 'SUPER_ADMIN' : 'ADMIN';

    let panelSessionId: string | undefined;
    try {
      const sessionId = await recordPanelSession(user.id, AUTH_CHANNELS.adminPanel, request);
      panelSessionId = isPanelJwtSidEnabled() ? sessionId : undefined;
    } catch {
      logAdminLoginFailure('server_error');
      return {
        ok: false,
        error: {
          code: 'server_error',
          message: 'Could not create panel session',
          status: 500,
        },
      };
    }

    let token: string;
    try {
      token = await signAdminToken(user.id, user.email, sessionRole, panelSessionId);
    } catch {
      logAdminLoginFailure('server_error');
      return {
        ok: false,
        error: {
          code: 'server_error',
          message: 'Could not issue session token',
          status: 500,
        },
      };
    }

    const displayName = user.adminProfile?.displayName ?? null;
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGIN_SUCCESS,
      channel: AUTH_CHANNELS.adminPanel,
      userId: user.id,
      role: user.role,
      ...ctx,
    });

    return {
      ok: true,
      value: {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName,
          name: displayName ?? user.email,
          role: sessionRole,
        },
      },
    };
  }

  async logout(request?: Request, userId?: string, sessionId?: string): Promise<void> {
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGOUT,
      channel: AUTH_CHANNELS.adminPanel,
      userId: userId ?? null,
      ...authRequestContext(request),
    });
    if (userId) {
      await revokePanelSession(userId, sessionId, AUTH_CHANNELS.adminPanel, 'logout');
    }
  }

  async resolveActor(session: AdminJwtPayload): Promise<AdminPanelActor | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        adminProfile: { select: { id: true, displayName: true } },
      },
    });

    if (!user?.adminProfile) return null;
    const roleOk = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!roleOk || user.status !== UserStatus.ACTIVE) return null;

    return {
      id: user.id,
      email: user.email,
      displayName: user.adminProfile.displayName,
      role: user.role,
    };
  }
}
