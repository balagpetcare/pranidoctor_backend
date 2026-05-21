import { SessionStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { isDeviceRegisterBindSessionEnabled } from './device.config.js';
import { getRefreshTokenService } from './refresh-token.service.js';

export async function bindDeviceToSession(
  userId: string,
  sessionId: string | undefined,
  deviceId: string,
): Promise<boolean> {
  if (!sessionId || !isDeviceRegisterBindSessionEnabled()) return false;

  const prisma = getPrisma();
  const session = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId,
      status: SessionStatus.ACTIVE,
    },
  });
  if (!session) return false;

  await prisma.userSession.update({
    where: { id: sessionId },
    data: { deviceId },
  });
  return true;
}

export async function attachDeviceToActiveRefreshTokens(
  userId: string,
  sessionId: string | undefined,
  deviceId: string,
): Promise<void> {
  if (!sessionId) return;
  const prisma = getPrisma();
  await prisma.refreshToken.updateMany({
    where: { userId, sessionId, revoked: false },
    data: { deviceId },
  });
}
