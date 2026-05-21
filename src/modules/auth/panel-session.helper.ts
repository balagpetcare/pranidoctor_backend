import { SessionStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { toPrismaAuthChannel } from './auth-channel.util.js';
import type { AuthChannel } from './identity-core.js';
import { getSessionService } from './session.service.js';

export async function revokePanelSession(
  userId: string,
  sessionId: string | undefined,
  channel: AuthChannel | string,
  reason = 'logout',
): Promise<boolean> {
  if (!isPanelLogoutSessionRevokeEnabled()) return false;
  if (sessionId) {
    return getSessionService().revoke(sessionId, reason, channel);
  }
  return revokeLatestPanelSession(userId, channel, reason);
}

export function isPanelLogoutSessionRevokeEnabled(): boolean {
  const raw = process.env.PANEL_LOGOUT_REVOKE_SESSION?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

/**
 * Revokes the most recent ACTIVE panel session for the user/channel (no JWT sid required).
 */
export async function revokeLatestPanelSession(
  userId: string,
  channel: AuthChannel | string,
  reason = 'logout',
): Promise<boolean> {
  if (!isPanelLogoutSessionRevokeEnabled()) return false;

  const prisma = getPrisma();
  const prismaChannel = toPrismaAuthChannel(channel);

  const latest = await prisma.userSession.findFirst({
    where: {
      userId,
      channel: prismaChannel,
      status: SessionStatus.ACTIVE,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latest) return false;

  return getSessionService().revoke(latest.id, reason, channel);
}
