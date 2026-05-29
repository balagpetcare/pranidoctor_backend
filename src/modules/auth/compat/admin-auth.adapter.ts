import { compatJsonOk } from '../../../compat/compat-api-response.js';
import { compatAuthJsonError } from '../i18n/compat-error.js';
import { messageKeyForErrorCode } from '../i18n/index.js';
import type { NextResponse } from '../../../compat/next-server.js';
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from '../../../legacy/web/lib/admin-auth/cookies.js';
import { getAdminSession } from '../../../legacy/web/lib/admin-auth/session.js';
import { logAdminLoginFailure } from '../../../legacy/web/lib/admin-auth/admin-login-errors.js';
import {
  parseAdminLoginBody,
} from '../services/panel-admin-auth.service.js';
import { AUTH_CHANNELS } from '../identity-core.js';
import { assertJwtSessionActive, touchJwtSession } from '../session-guard.helper.js';
import { getIdentityAuthService } from '../identity-auth.service.js';
import {
  getPanelLegalStatus,
  mapLegalSummaryForAuthMe,
} from '../../../legacy/web/lib/panel-legal/panel-legal.service.js';

export async function handleAdminLogin(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    logAdminLoginFailure('server_error');
    return compatAuthJsonError(request, 'server_error', 400, { messageKey: 'INVALID_JSON' });
  }

  const parsed = parseAdminLoginBody(json);
  if (!parsed.ok) {
    logAdminLoginFailure('server_error');
    const key = messageKeyForErrorCode(parsed.code);
    return compatAuthJsonError(request, parsed.code, parsed.status, {
      messageKey: key ?? undefined,
      message: key ? undefined : parsed.message,
      details: parsed.details,
    });
  }

  const result = await getIdentityAuthService().admin.login(parsed.data, request);
  if (!result.ok) {
    const key = messageKeyForErrorCode(result.error.code);
    return compatAuthJsonError(request, result.error.code, result.error.status, {
      messageKey: key ?? undefined,
      message: key ? undefined : result.error.message,
      details: result.error.details,
    });
  }

  const res = compatJsonOk({
    result: 'success' as const,
    user: result.value.user,
  });
  setAdminSessionCookie(res, result.value.token);
  return res;
}

export async function handleAdminLogout(request: Request): Promise<Response> {
  const session = await getAdminSession();
  await getIdentityAuthService().admin.logout(request, session?.sub, session?.sid);
  const res = compatJsonOk({ signedOut: true });
  clearAdminSessionCookie(res);
  return res;
}

export async function handleAdminMe(request: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return compatAuthJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' });
  }

  const guard = await assertJwtSessionActive(session, AUTH_CHANNELS.adminPanel, { panel: true });
  if (guard === 'revoked') {
    return compatAuthJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' });
  }

  const actor = await getIdentityAuthService().admin.resolveActor(session);
  if (!actor) {
    return compatAuthJsonError(request, 'FORBIDDEN', 403, {
      messageKey: 'FORBIDDEN_ADMIN_PANEL',
    });
  }

  await touchJwtSession(session);

  const legalStatus = await getPanelLegalStatus(actor.id, actor.role);

  return compatJsonOk({
    user: {
      id: actor.id,
      email: actor.email,
      displayName: actor.displayName,
      role: actor.role,
    },
    legal: mapLegalSummaryForAuthMe(legalStatus),
  });
}
