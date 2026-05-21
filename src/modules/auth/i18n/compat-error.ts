import { compatJsonError } from '../../../compat/compat-api-response.js';
import type { NextResponse } from '../../../compat/next-server.js';
import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';

import type { AuthMessageKey } from './catalog.types.js';
import {
  contentLanguageHeader,
  isFrozenBnAuthPath,
  resolveRequestLocale,
  type AuthLocale,
} from './locale.js';
import {
  credentialMessageKey,
  messageKeyForErrorCode,
  resolveAuthMessage,
  resolveAuthMessageForCode,
} from './index.js';

export type AuthErrorOptions = {
  messageKey?: AuthMessageKey;
  message?: string;
  details?: unknown;
  profileLocale?: string | null;
  forceLocale?: AuthLocale;
};

function mergeDetails(details: unknown | undefined, locale: AuthLocale): unknown {
  if (details === undefined) {
    return { locale };
  }
  if (details !== null && typeof details === 'object' && !Array.isArray(details)) {
    return { ...(details as Record<string, unknown>), locale };
  }
  return { locale, details };
}

function resolveMessage(
  request: Request,
  code: string,
  options?: AuthErrorOptions,
): { message: string; locale: AuthLocale } {
  const pathname = new URL(request.url).pathname;
  const forceLocale =
    options?.forceLocale ?? (isFrozenBnAuthPath(pathname) ? 'bn-BD' : undefined);
  const localeOpts: { profileLocale?: string | null; forceLocale?: AuthLocale } = {};
  if (options?.profileLocale !== undefined) localeOpts.profileLocale = options.profileLocale;
  if (forceLocale !== undefined) localeOpts.forceLocale = forceLocale;
  const locale = resolveRequestLocale(request, localeOpts);

  if (options?.message) {
    return { message: options.message, locale };
  }

  if (options?.messageKey) {
    return { message: resolveAuthMessage(options.messageKey, locale), locale };
  }

  const fromCode = resolveAuthMessageForCode(code, locale);
  if (fromCode) {
    return { message: fromCode, locale };
  }

  const credKey = credentialMessageKey(code);
  if (credKey) {
    return { message: resolveAuthMessage(credKey, locale), locale };
  }

  return { message: resolveAuthMessage('VALIDATION_ERROR', locale), locale };
}

/** Compat `{ ok, error }` response with localized message + Content-Language. */
export function authJsonError(
  request: Request,
  code: string,
  status: number,
  options?: AuthErrorOptions,
): Response {
  const { message, locale } = resolveMessage(request, code, options);
  const headers = contentLanguageHeader(locale);
  return jsonError(code, message, status, mergeDetails(options?.details, locale), { headers });
}

export function authJsonOk<T>(
  request: Request,
  data: T,
  init?: ResponseInit,
  options?: { profileLocale?: string | null },
): Response {
  const okOpts: { profileLocale?: string | null } = {};
  if (options?.profileLocale !== undefined) okOpts.profileLocale = options.profileLocale;
  const locale = resolveRequestLocale(request, okOpts);
  const headers = new Headers(init?.headers);
  headers.set('Content-Language', locale);
  return jsonOk(data, { ...init, headers });
}

/** Panel compat handlers (NextResponse shim). */
export function compatAuthJsonError(
  request: Request,
  code: string,
  status: number,
  options?: AuthErrorOptions,
): NextResponse {
  const { message, locale } = resolveMessage(request, code, options);
  const res = compatJsonError(code, message, status, mergeDetails(options?.details, locale));
  res.headers.set('Content-Language', locale);
  return res;
}
