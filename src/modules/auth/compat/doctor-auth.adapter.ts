import { compatJsonOk } from '../../../compat/compat-api-response.js';
import { compatAuthJsonError } from '../i18n/compat-error.js';
import { messageKeyForErrorCode } from '../i18n/index.js';

import {
  clearDoctorSessionCookie,
  setDoctorSessionCookie,
} from '../../../legacy/web/lib/doctor-auth/cookies.js';
import { getDoctorSession } from '../../../legacy/web/lib/doctor-auth/session.js';

import { AUTH_CHANNELS } from '../identity-core.js';
import { toDoctorMeUser } from '../panel-auth.dto.js';
import { assertJwtSessionActive, touchJwtSession } from '../session-guard.helper.js';
import { getIdentityAuthService } from '../identity-auth.service.js';

export async function handleDoctorLogin(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return compatAuthJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON' });
  }

  const parsed = getIdentityAuthService().doctor.parseLoginBody(json);
  if (!parsed.success) {
    return compatAuthJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR_LOGIN_PAYLOAD',
      details: parsed.error.flatten(),
    });
  }

  const result = await getIdentityAuthService().doctor.login(parsed.data, request);
  if (!result.ok) {
    const key = messageKeyForErrorCode(result.code);
    return compatAuthJsonError(request, result.code, result.status, {
      messageKey: key ?? undefined,
      message: key ? undefined : result.message,
      details: result.details,
    });
  }

  const res = compatJsonOk({ user: result.user });
  setDoctorSessionCookie(res, result.token);
  return res;
}

export async function handleDoctorLogout(request: Request): Promise<Response> {
  const session = await getDoctorSession();
  await getIdentityAuthService().doctor.logout(request, session?.sub, session?.sid);
  const res = compatJsonOk({ signedOut: true });
  clearDoctorSessionCookie(res);
  return res;
}

export async function handleDoctorMe(request: Request): Promise<Response> {
  const session = await getDoctorSession();
  if (!session) {
    return compatAuthJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' });
  }

  const guard = await assertJwtSessionActive(session, AUTH_CHANNELS.doctorPanel, { panel: true });
  if (guard === 'revoked') {
    return compatAuthJsonError(request, 'UNAUTHORIZED', 401, { messageKey: 'UNAUTHORIZED' });
  }

  const actor = await getIdentityAuthService().doctor.resolveActor(session);
  if (!actor) {
    return compatAuthJsonError(request, 'FORBIDDEN', 403, {
      messageKey: 'FORBIDDEN_DOCTOR_PANEL',
    });
  }

  await touchJwtSession(session);

  return compatJsonOk({ user: toDoctorMeUser(actor) });
}
