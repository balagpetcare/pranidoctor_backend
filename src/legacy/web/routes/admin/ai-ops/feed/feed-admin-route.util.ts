import { jsonError } from '@/lib/api-response';
import {
  requireAdminApiActor,
  type AdminPanelActor,
} from '../../../../lib/admin-auth/api-guard.js';
import {
  assertFeedAdminCan,
  type FeedAdminCapability,
} from '../../../../../../modules/ai/feed/admin/index.js';

const FEED_PANEL_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);

/**
 * Feed admin auth: panel session (incl. SUPPORT) + feed capability matrix.
 * Policy A — SUPPORT: ai.feed.view + ai.feed.audit only.
 */
export async function requireFeedAdmin(
  capability: FeedAdminCapability,
  request?: Request,
): Promise<
  | { ok: true; actor: AdminPanelActor }
  | { ok: false; response: Response }
> {
  const auth = await requireAdminApiActor(request);
  if (!auth.ok) return auth;
  if (!FEED_PANEL_ROLES.has(auth.actor.role)) {
    return {
      ok: false,
      response: jsonError('FORBIDDEN', 'Feed admin panel role required', 403),
    };
  }
  const denied = assertFeedAdminCan({ id: auth.actor.id, role: auth.actor.role }, capability);
  if (denied) return { ok: false, response: denied };
  return { ok: true, actor: auth.actor };
}

export async function parseJsonBody(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
}
