import { describe, expect, it } from 'vitest';

import { OTP_MSG } from '../../../legacy/web/lib/mobile-auth/otp-messages.js';
import { CRED_MSG } from '../../../legacy/web/lib/mobile-auth/customer-credentials-messages.js';
import {
  credentialMessageKey,
  messageKeyForErrorCode,
  resolveAuthMessage,
} from './index.js';
import { parseAcceptLanguage, resolveLocale, isFrozenBnAuthPath } from './locale.js';

describe('auth i18n', () => {
  it('parses Accept-Language with q values', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,bn;q=0.8')).toBe('en-US');
    expect(parseAcceptLanguage('bn-BD')).toBe('bn-BD');
  });

  it('defaults to bn-BD', () => {
    expect(resolveLocale(null, null)).toBe('bn-BD');
  });

  it('uses profile locale when header absent', () => {
    expect(resolveLocale(null, 'en-US')).toBe('en-US');
  });

  it('OTP bn messages match frozen OTP_MSG', () => {
    expect(resolveAuthMessage('OTP_WRONG', 'bn-BD')).toBe(OTP_MSG.wrongCode);
    expect(resolveAuthMessage('OTP_EXPIRED', 'bn-BD')).toBe(OTP_MSG.expired);
    expect(resolveAuthMessage('OTP_VALIDATION_PHONE', 'bn-BD')).toBe(OTP_MSG.validationPhone);
  });

  it('CRED bn messages match frozen CRED_MSG', () => {
    expect(resolveAuthMessage('CRED_DUPLICATE_PHONE', 'bn-BD')).toBe(CRED_MSG.duplicatePhone);
    expect(resolveAuthMessage('CRED_WRONG_IDENTIFIER_OR_PASSWORD', 'bn-BD')).toBe(
      CRED_MSG.wrongIdentifierOrPassword,
    );
  });

  it('resolves en-US device messages', () => {
    expect(resolveAuthMessage('DEVICE_PLATFORM_INVALID', 'en-US')).toContain('android');
  });

  it('maps legacy error codes', () => {
    expect(messageKeyForErrorCode('invalid_credentials')).toBe('INVALID_CREDENTIALS');
    expect(messageKeyForErrorCode('db_unavailable')).toBe('DB_UNAVAILABLE');
    expect(credentialMessageKey('DUPLICATE_PHONE')).toBe('CRED_DUPLICATE_PHONE');
  });

  it('detects frozen bn auth paths', () => {
    expect(isFrozenBnAuthPath('/api/mobile/auth/otp/verify')).toBe(true);
    expect(isFrozenBnAuthPath('/api/mobile/auth/login')).toBe(true);
    expect(isFrozenBnAuthPath('/api/mobile/devices/register')).toBe(false);
    expect(isFrozenBnAuthPath('/api/mobile/auth/refresh')).toBe(false);
  });
});
