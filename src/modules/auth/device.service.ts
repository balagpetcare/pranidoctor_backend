import { SessionStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
import { AuthAuditAction } from '../../generated/prisma/index.js';
import { authRequestContext, recordAuthAuditFireAndForget } from './auth-audit.service.js';
import { AUTH_CHANNELS } from './identity-core.js';
import { isDeviceRevokeCascadeSessionsEnabled } from './device.config.js';
import { getRefreshTokenService } from './refresh-token.service.js';

export type RegisterDeviceInput = {
  userId: string;
  deviceKey: string;
  platform?: string;
  pushToken?: string;
  appVersion?: string;
};

export type DeviceListItem = {
  id: string;
  deviceKey: string;
  platform: string | null;
  appVersion: string | null;
  lastActiveAt: Date;
  hasPushToken: boolean;
};

export class DeviceService {
  async registerOrUpdate(
    input: RegisterDeviceInput,
  ): Promise<{ id: string; replaced: boolean }> {
    const prisma = getPrisma();
    const existing = await prisma.userDevice.findUnique({
      where: {
        userId_deviceKey: { userId: input.userId, deviceKey: input.deviceKey },
      },
    });

    const row = await prisma.userDevice.upsert({
      where: {
        userId_deviceKey: { userId: input.userId, deviceKey: input.deviceKey },
      },
      create: {
        userId: input.userId,
        deviceKey: input.deviceKey,
        platform: input.platform ?? null,
        pushToken: input.pushToken ?? null,
        appVersion: input.appVersion ?? null,
        lastActiveAt: new Date(),
      },
      update: {
        lastActiveAt: new Date(),
        revokedAt: null,
        ...omitUndefined({
          platform: input.platform,
          pushToken: input.pushToken,
          appVersion: input.appVersion,
        }),
      },
    });

    return { id: row.id, replaced: existing !== null };
  }

  async isActive(deviceId: string, userId?: string): Promise<boolean> {
    const prisma = getPrisma();
    const row = await prisma.userDevice.findFirst({
      where: {
        id: deviceId,
        ...(userId ? { userId } : {}),
        revokedAt: null,
      },
    });
    return row !== null;
  }

  async listActiveForUser(userId: string): Promise<DeviceListItem[]> {
    const prisma = getPrisma();
    const rows = await prisma.userDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      deviceKey: r.deviceKey,
      platform: r.platform,
      appVersion: r.appVersion,
      lastActiveAt: r.lastActiveAt,
      hasPushToken: r.pushToken != null && r.pushToken.length > 0,
    }));
  }

  async revoke(userId: string, deviceId: string): Promise<boolean> {
    const prisma = getPrisma();
    const result = await prisma.userDevice.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async revokeWithCascade(
    userId: string,
    deviceId: string,
    request?: Request,
  ): Promise<{ revoked: boolean; sessionsRevoked: number }> {
    const revoked = await this.revoke(userId, deviceId);
    if (!revoked) return { revoked: false, sessionsRevoked: 0 };

    let sessionsRevoked = 0;
    if (isDeviceRevokeCascadeSessionsEnabled()) {
      const prisma = getPrisma();
      const result = await prisma.userSession.updateMany({
        where: {
          userId,
          deviceId,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: 'device_revoke',
        },
      });
      sessionsRevoked = result.count;
      await getRefreshTokenService().revokeForDevice(userId, deviceId);
    }

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.DEVICE_REVOKED,
      channel: AUTH_CHANNELS.mobile,
      userId,
      ...authRequestContext(request),
      metadata: { deviceId, sessionsRevoked, cascade: isDeviceRevokeCascadeSessionsEnabled() },
    });

    return { revoked: true, sessionsRevoked };
  }

  async touch(deviceId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.userDevice.update({
      where: { id: deviceId },
      data: { lastActiveAt: new Date() },
    });
  }
}

let deviceService: DeviceService | null = null;

export function getDeviceService(): DeviceService {
  if (!deviceService) {
    deviceService = new DeviceService();
  }
  return deviceService;
}
