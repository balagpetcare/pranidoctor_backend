import { ERROR_CODE_TO_MESSAGE_KEY, type AuthMessageKey } from './catalog.types.js';
import type { AuthLocale } from './locale.js';
import { DEFAULT_AUTH_LOCALE } from './locale.js';
import { MESSAGES_BN_BD, OTP_MSG, otpHourlyRateLimitMessageBn, otpResendCooldownMessageBn } from './messages.bn-BD.js';
import { MESSAGES_EN_US, otpHourlyRateLimitMessageEn, otpResendCooldownMessageEn } from './messages.en-US.js';

export type { AuthLocale, AuthMessageKey };
export {
  DEFAULT_AUTH_LOCALE,
  parseAcceptLanguage,
  resolveLocale,
  resolveRequestLocale,
  isFrozenBnAuthPath,
  contentLanguageHeader,
  normalizeLocaleTag,
} from './locale.js';
export { ERROR_CODE_TO_MESSAGE_KEY } from './catalog.types.js';
export { OTP_MSG, CRED_MSG } from './messages.bn-BD.js';
export { otpResendCooldownMessageBn, otpHourlyRateLimitMessageBn };
export { otpResendCooldownMessageEn, otpHourlyRateLimitMessageEn };

export type MessageParams = Record<string, string | number>;

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v !== undefined ? String(v) : `{${key}}`;
  });
}

export function resolveAuthMessage(
  key: AuthMessageKey,
  locale: AuthLocale,
  params?: MessageParams,
): string {
  const table = locale === 'en-US' ? MESSAGES_EN_US : MESSAGES_BN_BD;
  const template = table[key] ?? MESSAGES_BN_BD[key];
  return interpolate(template, params);
}

export function messageKeyForErrorCode(code: string): AuthMessageKey | null {
  return ERROR_CODE_TO_MESSAGE_KEY[code] ?? null;
}

export function resolveAuthMessageForCode(
  code: string,
  locale: AuthLocale,
  params?: MessageParams,
): string | null {
  const key = messageKeyForErrorCode(code);
  if (!key) return null;
  return resolveAuthMessage(key, locale, params);
}

/** Credential result codes from customer-credentials-service. */
export function credentialMessageKey(code: string): AuthMessageKey | null {
  const map: Record<string, AuthMessageKey> = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    DUPLICATE_PHONE: 'CRED_DUPLICATE_PHONE',
    DUPLICATE_EMAIL: 'CRED_DUPLICATE_EMAIL',
    WRONG_IDENTIFIER_OR_PASSWORD: 'CRED_WRONG_IDENTIFIER_OR_PASSWORD',
    SIGNUP_FAILED: 'CRED_SIGNUP_FAILED',
  };
  return map[code] ?? null;
}
