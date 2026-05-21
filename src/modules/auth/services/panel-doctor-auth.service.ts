import bcrypt from 'bcryptjs';
import { z } from 'zod';

import {
  AuthAuditAction,
  Prisma,
  ProviderStatus,
  UserRole,
  UserStatus,
} from '../../../generated/prisma/index.js';
import { isAuthDatabaseConnectivityError } from '../db-connectivity.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { authRequestContext, recordAuthAuditFireAndForget } from '../auth-audit.service.js';
import { recordPanelSession } from '../mobile-auth-credentials.service.js';
import type { DoctorPanelActorWithProfile } from '../panel-auth.dto.js';
import { revokePanelSession } from '../panel-session.helper.js';
import { isPanelJwtSidEnabled } from '../session-guard.config.js';
import { AUTH_CHANNELS } from '../identity-core.js';
import {
  getDoctorJwtSecret,
  signDoctorToken,
  type DoctorJwtPayload,
} from '../tokens/panel-doctor-token.js';

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type DoctorLoginBody = z.infer<typeof loginBodySchema>;

export class PanelDoctorAuthService {
  parseLoginBody(json: unknown) {
    return loginBodySchema.safeParse(json);
  }

  async login(
    body: DoctorLoginBody,
    request?: Request,
  ): Promise<
    | {
        ok: true;
        token: string;
        user: {
          id: string;
          email: string;
          displayName: string | null;
          name: string;
          role: 'DOCTOR';
        };
      }
    | { ok: false; code: string; message: string; status: number; details?: unknown }
  > {
    const ctx = authRequestContext(request);

    if (!getDoctorJwtSecret()) {
      return {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Doctor JWT secret is not configured on the server',
        status: 500,
      };
    }

    const prisma = getPrisma();
    let user;
    try {
      user = await prisma.user.findFirst({
        where: { email: { equals: body.email, mode: 'insensitive' } },
        include: { doctorProfile: true },
      });
    } catch (e: unknown) {
      if (isAuthDatabaseConnectivityError(e)) {
        return {
          ok: false,
          code: 'db_unavailable',
          message: 'Could not reach the database',
          status: 503,
        };
      }
      const prismaCode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
      return {
        ok: false,
        code: 'server_error',
        message: 'Unexpected error during sign-in',
        status: 500,
        ...(prismaCode ? { details: { prismaCode } } : {}),
      };
    }

    const canUseDoctorPanel =
      user &&
      user.role === UserRole.DOCTOR &&
      user.status === UserStatus.ACTIVE &&
      user.doctorProfile &&
      user.doctorProfile.providerStatus === ProviderStatus.ACTIVE;

    if (!canUseDoctorPanel || !user) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.LOGIN_FAILURE,
        channel: AUTH_CHANNELS.doctorPanel,
        ...ctx,
        metadata: { code: 'INVALID_CREDENTIALS' },
      });
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        status: 401,
      };
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.LOGIN_FAILURE,
        channel: AUTH_CHANNELS.doctorPanel,
        userId: user.id,
        role: user.role,
        ...ctx,
        metadata: { code: 'INVALID_CREDENTIALS' },
      });
      return {
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        status: 401,
      };
    }

    let panelSessionId: string | undefined;
    try {
      const sessionId = await recordPanelSession(user.id, AUTH_CHANNELS.doctorPanel, request);
      panelSessionId = isPanelJwtSidEnabled() ? sessionId : undefined;
    } catch {
      return {
        ok: false,
        code: 'server_error',
        message: 'Could not create panel session',
        status: 500,
      };
    }

    let token: string;
    try {
      token = await signDoctorToken(user.id, user.email, panelSessionId);
    } catch {
      return {
        ok: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Could not issue session token',
        status: 500,
      };
    }

    const displayName = user.doctorProfile?.displayName ?? null;
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGIN_SUCCESS,
      channel: AUTH_CHANNELS.doctorPanel,
      userId: user.id,
      role: user.role,
      ...ctx,
    });

    return {
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName,
        name: displayName ?? user.email,
        role: 'DOCTOR',
      },
    };
  }

  async logout(request?: Request, userId?: string, sessionId?: string): Promise<void> {
    const ctx = authRequestContext(request);
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGOUT,
      channel: AUTH_CHANNELS.doctorPanel,
      userId: userId ?? null,
      ...ctx,
    });
    if (userId) {
      await revokePanelSession(userId, sessionId, AUTH_CHANNELS.doctorPanel, 'logout');
    }
  }

  async resolveActor(session: DoctorJwtPayload): Promise<DoctorPanelActorWithProfile | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        doctorProfile: {
          select: { id: true, displayName: true, providerStatus: true },
        },
      },
    });

    if (!user?.doctorProfile) return null;
    if (user.role !== UserRole.DOCTOR || user.status !== UserStatus.ACTIVE) return null;
    if (user.doctorProfile.providerStatus !== ProviderStatus.ACTIVE) return null;

    return {
      userId: user.id,
      doctorProfileId: user.doctorProfile.id,
      email: user.email,
      displayName: user.doctorProfile.displayName,
      providerStatus: user.doctorProfile.providerStatus,
    };
  }
}
