import { z } from 'zod';

import { jsonOk } from '../../../legacy/web/lib/api-response.js';
import { authJsonError } from '../i18n/compat-error.js';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '../../partner-auth/password-reset.service.js';

const forgotSchema = z
  .object({
    identifier: z.string().min(3).max(200),
    channel: z.enum(['sms', 'email']),
  })
  .strict();

const resetSchema = z
  .object({
    identifier: z.string().min(3).max(200),
    code: z.string().min(4).max(10),
    newPassword: z.string().min(1).max(200),
  })
  .strict();

async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** POST /api/mobile/auth/password/forgot — send reset code by SMS or e-mail. */
export async function handlePasswordForgot(request: Request): Promise<Response> {
  const json = await readJson(request);
  if (json === undefined) {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON', forceLocale: 'bn-BD' });
  }
  const parsed = forgotSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
      forceLocale: 'bn-BD',
    });
  }

  const result = await requestPasswordReset(parsed.data);
  if (!result.ok) {
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }
  // Same answer whether or not the account exists.
  return jsonOk({ sent: true as const, ttlSeconds: 600 });
}

/** POST /api/mobile/auth/password/reset — verify code and set a new password. */
export async function handlePasswordReset(request: Request): Promise<Response> {
  const json = await readJson(request);
  if (json === undefined) {
    return authJsonError(request, 'INVALID_JSON', 400, { messageKey: 'INVALID_JSON', forceLocale: 'bn-BD' });
  }
  const parsed = resetSchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
      forceLocale: 'bn-BD',
    });
  }

  const result = await confirmPasswordReset(parsed.data);
  if (!result.ok) {
    return authJsonError(request, result.code, result.httpStatus, {
      message: result.message,
      forceLocale: 'bn-BD',
    });
  }
  return jsonOk({ reset: true as const });
}
