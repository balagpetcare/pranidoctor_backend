import { jsonError } from '../api-response.js';

import { classifyAdminPanelAuth } from './panel-classify.js';
import {
  resolveAdminPanelActor,
  type AdminPanelActor,
} from './panel-access.js';
import { getAdminSession } from './session.js';

export type { AdminPanelActor } from './panel-classify.js';
export { resolveAdminPanelActor } from './panel-access.js';

export async function requireAdminPanelApiAccess(): Promise<Response | null> {
  const session = await getAdminSession();
  const actor = session ? await resolveAdminPanelActor(session) : null;
  const kind = classifyAdminPanelAuth(session, actor);
  if (kind === 'unauthenticated') {
    return jsonError('UNAUTHORIZED', 'Not signed in', 401);
  }
  if (kind === 'forbidden') {
    return jsonError('FORBIDDEN', 'Admin panel access required', 403);
  }
  return null;
}

export type RequireAdminApiActorResult =
  | { ok: true; actor: AdminPanelActor }
  | { ok: false; response: Response };

/**
 * Resolves the current admin user once for route handlers (single DB round-trip when ok).
 */
export async function requireAdminApiActor(): Promise<RequireAdminApiActorResult> {
  const session = await getAdminSession();
  const actor = session ? await resolveAdminPanelActor(session) : null;
  const kind = classifyAdminPanelAuth(session, actor);
  if (kind === 'unauthenticated') {
    return {
      ok: false,
      response: jsonError('UNAUTHORIZED', 'Not signed in', 401),
    };
  }
  if (kind === 'forbidden') {
    return {
      ok: false,
      response: jsonError('FORBIDDEN', 'Admin panel access required', 403),
    };
  }
  return { ok: true, actor: actor! };
}
