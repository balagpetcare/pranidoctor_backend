import type { AuthChannel } from './identity-core.js';
import {
  isMobileSessionGuardEnabled,
  isPanelSessionGuardEnabled,
} from './session-guard.config.js';
import { getSessionService } from './session.service.js';

export type JwtSessionGuardResult = 'ok' | 'revoked' | 'legacy';

export type JwtSessionPayload = {
  sub: string;
  sid?: string;
};

export async function assertJwtSessionActive(
  payload: JwtSessionPayload,
  channel: AuthChannel | string,
  options?: { panel?: boolean },
): Promise<JwtSessionGuardResult> {
  if (!payload.sid) return 'legacy';

  const guardOn = options?.panel ? isPanelSessionGuardEnabled() : isMobileSessionGuardEnabled();
  if (!guardOn) return 'legacy';

  const row = await getSessionService().assertActive(payload.sid);
  if (!row) return 'revoked';
  if (row.userId !== payload.sub) return 'revoked';

  return 'ok';
}

export async function touchJwtSession(payload: JwtSessionPayload): Promise<void> {
  if (!payload.sid) return;
  await getSessionService().touch(payload.sid).catch(() => {});
}
