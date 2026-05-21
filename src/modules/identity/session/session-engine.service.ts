import { SessionStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getDeviceService } from '../../auth/device.service.js';
import { getSessionService } from '../../auth/session.service.js';

import type { DeviceSummaryDto, SessionActivityDto } from '../identity.types.js';

export class SessionEngine {
  async listDevices(userId: string): Promise<DeviceSummaryDto[]> {
    const devices = await getDeviceService().listActiveForUser(userId);
    return devices.map((d) => ({
      id: d.id,
      deviceKey: d.deviceKey,
      platform: d.platform,
      appVersion: d.appVersion,
      lastActiveAt: d.lastActiveAt.toISOString(),
      hasPushToken: d.hasPushToken,
    }));
  }

  async revokeDevice(
    userId: string,
    deviceId: string,
  ): Promise<{ revoked: boolean; sessionsRevoked: number }> {
    return getDeviceService().revokeWithCascade(userId, deviceId);
  }

  async getActivity(userId: string): Promise<SessionActivityDto> {
    const prisma = getPrisma();
    const [activeSessionCount, activeDeviceCount] = await Promise.all([
      prisma.userSession.count({
        where: { userId, status: SessionStatus.ACTIVE, expiresAt: { gt: new Date() } },
      }),
      prisma.userDevice.count({ where: { userId, revokedAt: null } }),
    ]);

    return { activeSessionCount, activeDeviceCount };
  }

  async touchSession(sessionId: string): Promise<void> {
    await getSessionService().touch(sessionId);
  }
}

let engine: SessionEngine | null = null;

export function getSessionEngine(): SessionEngine {
  if (!engine) engine = new SessionEngine();
  return engine;
}
