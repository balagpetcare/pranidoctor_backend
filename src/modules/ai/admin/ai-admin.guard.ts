import { jsonError } from '../../../legacy/web/lib/api-response.js';
import { requireAdminApiActor } from '../../../legacy/web/lib/admin-auth/api-guard.js';

export type AiAdminActor = {
  id: string;
  role: string;
};

export type AiAdminAuthResult =
  | { ok: true; actor: AiAdminActor }
  | { ok: false; response: Response };

export async function requireAiAdminActor(): Promise<AiAdminAuthResult> {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return { ok: false, response: jsonError('FORBIDDEN', 'Admin role required', 403) };
  }
  return { ok: true, actor: { id: auth.actor.id, role: auth.actor.role } };
}

export async function requireAiSuperAdmin(): Promise<AiAdminAuthResult> {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth;
  if (auth.actor.role !== 'SUPER_ADMIN') {
    return { ok: false, response: jsonError('FORBIDDEN', 'SUPER_ADMIN role required', 403) };
  }
  return auth;
}

export function actorContext(
  request: Request,
  actor: AiAdminActor,
): { userId: string; role: string; ipAddress?: string } {
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    userId: actor.id,
    role: actor.role,
    ipAddress: forwarded?.split(',')[0]?.trim() ?? undefined,
  };
}
