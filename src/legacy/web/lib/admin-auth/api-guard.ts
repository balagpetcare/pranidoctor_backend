import { getCompatWebRequest } from '../../../../modules/compat-web/next-adapter.js';
import { getExpressRequest } from 'next/headers';

import { jsonError } from '../api-response.js';

import { classifyAdminPanelAuth } from './panel-classify.js';
import {
  resolveAdminPanelActor,
  type AdminPanelActor,
} from './panel-access.js';
import { getAdminSession } from './session.js';

export type { AdminPanelActor } from './panel-classify.js';
export { resolveAdminPanelActor } from './panel-access.js';

/**
 * Compat routes receive a Fetch `Request` with cookies; guards must not rely on
 * Express ALS alone (dynamic import / await can drop context before auth runs).
 */
export function resolveCompatRouteRequest(handlerRequest?: Request): Request | undefined {
  if (handlerRequest) return handlerRequest;
  const fromStore = getCompatWebRequest();
  if (fromStore) return fromStore;
  const expressReq = getExpressRequest();
  const cookie = expressReq?.headers?.cookie;
  if (typeof cookie === 'string' && cookie.length > 0) {
    return new Request('http://compat.internal/auth', { headers: { cookie } });
  }
  return undefined;
}

export async function requireAdminPanelApiAccess(
  request?: Request,
): Promise<Response | null> {
  const session = await getAdminSession(resolveCompatRouteRequest(request));
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
export async function requireAdminApiActor(
  request?: Request,
): Promise<RequireAdminApiActorResult> {
  const session = await getAdminSession(resolveCompatRouteRequest(request));
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
