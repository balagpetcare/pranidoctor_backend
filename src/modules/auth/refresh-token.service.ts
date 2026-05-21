import { createHash, randomBytes } from 'node:crypto';

import { AuthAuditAction } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { recordAuthAuditFireAndForget } from './auth-audit.service.js';
import { toPrismaAuthChannel } from './auth-channel.util.js';
import { AUTH_CHANNELS, type AuthChannel } from './identity-core.js';
import {
  getRefreshTokenPepper,
  getRefreshTokenTtlSeconds,
  isAuthRefreshEnabled,
} from './refresh-token.config.js';
import { isRefreshRejectRevokedDeviceEnabled } from './device.config.js';
import { getDeviceService } from './device.service.js';
import { getSessionService } from './session.service.js';
import { signMobileCustomerToken, MOBILE_SESSION_MAX_AGE } from './tokens/mobile-jwt.js';

export type IssueRefreshResult = {
  rawToken: string;
  expiresAt: Date;
  tokenId: string;
};

export type RotateRefreshResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
};

function hashRefreshToken(raw: string): string {
  const pepper = getRefreshTokenPepper();
  if (!pepper) {
    throw new Error('Refresh token pepper is not configured');
  }
  return createHash('sha256').update(`${pepper}:${raw}`).digest('hex');
}

function generateRawRefreshToken(): string {
  return `pd_rt_${randomBytes(32).toString('base64url')}`;
}

export class RefreshTokenService {
  isEnabled(): boolean {
    return isAuthRefreshEnabled() && getRefreshTokenPepper() !== null;
  }

  async issue(input: {
    userId: string;
    sessionId: string;
    channel?: AuthChannel | string;
    deviceId?: string;
  }): Promise<IssueRefreshResult | null> {
    if (!this.isEnabled()) return null;

    const prisma = getPrisma();
    const ttl = getRefreshTokenTtlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const rawToken = generateRawRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);

    const row = await prisma.refreshToken.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        tokenHash,
        channel: toPrismaAuthChannel(input.channel ?? AUTH_CHANNELS.mobile),
        deviceId: input.deviceId ?? null,
        expiresAt,
      },
    });

    return { rawToken, expiresAt, tokenId: row.id };
  }

  async rotate(
    rawToken: string,
    auditContext?: { ipAddress?: string; userAgent?: string },
  ): Promise<RotateRefreshResult | null> {
    if (!this.isEnabled()) return null;

    const prisma = getPrisma();
    const tokenHash = hashRefreshToken(rawToken);

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });

    if (!existing) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.REFRESH_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...auditContext,
        metadata: { code: 'TOKEN_NOT_FOUND' },
      });
      return null;
    }

    if (existing.revoked) {
      await this.revokeAllForSession(existing.userId, existing.sessionId, 'refresh_reuse');
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.REFRESH_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        userId: existing.userId,
        ...auditContext,
        metadata: { code: 'TOKEN_REUSE', sessionId: existing.sessionId },
      });
      return null;
    }

    if (existing.expiresAt < new Date()) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.REFRESH_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        userId: existing.userId,
        ...auditContext,
        metadata: { code: 'TOKEN_EXPIRED' },
      });
      return null;
    }

    const session = await getSessionService().assertActive(existing.sessionId);
    if (!session) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.REFRESH_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        userId: existing.userId,
        ...auditContext,
        metadata: { code: 'SESSION_INACTIVE' },
      });
      return null;
    }

    if (existing.deviceId && isRefreshRejectRevokedDeviceEnabled()) {
      const deviceActive = await getDeviceService().isActive(existing.deviceId, existing.userId);
      if (!deviceActive) {
        recordAuthAuditFireAndForget({
          action: AuthAuditAction.REFRESH_FAILURE,
          channel: AUTH_CHANNELS.mobile,
          userId: existing.userId,
          ...auditContext,
          metadata: { code: 'DEVICE_REVOKED', deviceId: existing.deviceId },
        });
        return null;
      }
    }

    const newRaw = generateRawRefreshToken();
    const newHash = hashRefreshToken(newRaw);
    const ttl = getRefreshTokenTtlSeconds();
    const newExpiresAt = new Date(Date.now() + ttl * 1000);

    const newRow = await prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          sessionId: existing.sessionId,
          tokenHash: newHash,
          channel: existing.channel,
          deviceId: existing.deviceId,
          expiresAt: newExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revoked: true,
          revokedAt: new Date(),
          rotatedAt: new Date(),
          rotatedToId: created.id,
          lastUsedAt: new Date(),
        },
      });

      return created;
    });

    await getSessionService().touch(existing.sessionId);

    const accessToken = await signMobileCustomerToken(existing.userId, existing.sessionId);

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.REFRESH_SUCCESS,
      channel: AUTH_CHANNELS.mobile,
      userId: existing.userId,
      ...auditContext,
      metadata: { sessionId: existing.sessionId, tokenId: newRow.id },
    });

    return {
      accessToken,
      refreshToken: newRaw,
      expiresIn: MOBILE_SESSION_MAX_AGE,
      refreshExpiresIn: ttl,
    };
  }

  async revokeForSession(userId: string, sessionId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.refreshToken.updateMany({
      where: { userId, sessionId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async revokeForDevice(userId: string, deviceId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.refreshToken.updateMany({
      where: { userId, deviceId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }

  private async revokeAllForSession(userId: string, sessionId: string, reason: string): Promise<void> {
    await getSessionService().revoke(sessionId, reason, AUTH_CHANNELS.mobile);
    await this.revokeForSession(userId, sessionId);
  }
}

let refreshTokenService: RefreshTokenService | null = null;

export function getRefreshTokenService(): RefreshTokenService {
  if (!refreshTokenService) {
    refreshTokenService = new RefreshTokenService();
  }
  return refreshTokenService;
}
