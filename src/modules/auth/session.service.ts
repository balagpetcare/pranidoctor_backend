import {
  AuthChannel as PrismaAuthChannel,
  SessionStatus,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { AuthAuditAction } from '../../generated/prisma/index.js';
import { recordAuthAuditFireAndForget } from './auth-audit.service.js';
import { toPrismaAuthChannel } from './auth-channel.util.js';
import { getRefreshTokenTtlSeconds } from './refresh-token.config.js';
import type { AuthChannel } from './identity-core.js';

export type CreateSessionInput = {
  userId: string;
  channel: AuthChannel | string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  ttlSeconds?: number;
};

export class SessionService {
  async create(input: CreateSessionInput): Promise<{ id: string; expiresAt: Date }> {
    const prisma = getPrisma();
    const ttl = input.ttlSeconds ?? getRefreshTokenTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const row = await prisma.userSession.create({
      data: {
        userId: input.userId,
        channel: toPrismaAuthChannel(input.channel),
        status: SessionStatus.ACTIVE,
        expiresAt,
        deviceId: input.deviceId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    return { id: row.id, expiresAt: row.expiresAt };
  }

  async assertActive(sessionId: string): Promise<{
    id: string;
    userId: string;
    channel: PrismaAuthChannel;
  } | null> {
    const prisma = getPrisma();
    const row = await prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!row) return null;
    if (row.status !== SessionStatus.ACTIVE) return null;
    if (row.expiresAt < new Date()) {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.EXPIRED },
      });
      return null;
    }
    return { id: row.id, userId: row.userId, channel: row.channel };
  }

  async touch(sessionId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  }

  async revoke(sessionId: string, reason?: string, auditChannel?: string): Promise<boolean> {
    const prisma = getPrisma();
    const row = await prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!row || row.status === SessionStatus.REVOKED) return false;

    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason ?? 'logout',
      },
    });

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.SESSION_REVOKED,
      channel: auditChannel ?? row.channel.toLowerCase(),
      userId: row.userId,
      metadata: { sessionId, reason: reason ?? 'logout' },
    });

    return true;
  }

  async revokeAllForUser(
    userId: string,
    options?: { exceptSessionId?: string; reason?: string; channel?: AuthChannel | string },
  ): Promise<number> {
    const prisma = getPrisma();
    const result = await prisma.userSession.updateMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        ...(options?.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: options?.reason ?? 'logout_all',
      },
    });

    if (result.count > 0) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.SESSION_REVOKED,
        channel: options?.channel ?? 'mobile',
        userId,
        metadata: { count: result.count, reason: options?.reason ?? 'logout_all' },
      });
    }

    return result.count;
  }
}

let sessionService: SessionService | null = null;

export function getSessionService(): SessionService {
  if (!sessionService) {
    sessionService = new SessionService();
  }
  return sessionService;
}
