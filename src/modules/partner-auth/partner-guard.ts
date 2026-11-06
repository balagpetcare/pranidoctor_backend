import { UserRole, UserStatus } from '../../generated/prisma/index.js';
import { authJsonError } from '../auth/i18n/compat-error.js';
import { AUTH_CHANNELS } from '../auth/identity-core.js';
import { assertJwtSessionActive, touchJwtSession } from '../auth/session-guard.helper.js';
import { verifyMobileJwt } from '../auth/tokens/mobile-jwt.js';
import { getPrisma } from '../../shared/database/prisma.js';

export type PartnerGuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

const ALLOWED_ROLES: UserRole[] = [
  UserRole.CUSTOMER,
  UserRole.DOCTOR,
  UserRole.AI_TECHNICIAN,
  UserRole.HEALTH_WORKER,
];

function bearer(request: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization')?.trim() ?? '');
  return m?.[1]?.trim() || null;
}

/** Signed-in, active user of any partner-capable role (customer accounts included — that is how partners start). */
export async function requirePartnerUser(request: Request): Promise<PartnerGuardResult> {
  const token = bearer(request);
  if (!token) {
    return {
      ok: false,
      response: authJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED_BEARER_REQUIRED' }),
    };
  }
  const payload = await verifyMobileJwt(token);
  if (!payload) {
    return { ok: false, response: authJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' }) };
  }
  if ((await assertJwtSessionActive(payload, AUTH_CHANNELS.mobile)) === 'revoked') {
    return { ok: false, response: authJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' }) };
  }
  const user = await getPrisma().user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE || !ALLOWED_ROLES.includes(user.role)) {
    return { ok: false, response: authJsonError(request, 'FORBIDDEN', 403, { message: 'অ্যাকাউন্টটি ব্যবহার করা যাবে না।', forceLocale: 'bn-BD' }) };
  }
  await touchJwtSession(payload);
  return { ok: true, userId: user.id };
}
