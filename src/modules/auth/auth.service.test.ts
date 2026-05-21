import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { AuthService } from './auth.service.js';
import type { IdentityAuthService } from './identity-auth.service.js';

vi.mock('./mobile-auth-credentials.service.js', () => ({
  issueCredentialsAfterOtpVerify: vi.fn(),
  logoutAllForUser: vi.fn(),
}));

vi.mock('./refresh-token.service.js', () => ({
  getRefreshTokenService: vi.fn(() => ({
    rotate: vi.fn(),
  })),
}));

vi.mock('../../legacy/web/lib/mobile-auth/otp-env.js', () => ({
  getOtpConfig: vi.fn(() => ({
    ttlSeconds: 900,
    resendCooldownSeconds: 60,
  })),
}));

vi.mock('./auth-audit.service.js', () => ({
  authRequestContext: vi.fn(() => ({})),
  recordAuthAuditFireAndForget: vi.fn(),
}));

vi.mock('../../shared/logger/logger.js', () => ({
  logInfo: vi.fn(),
}));

import { issueCredentialsAfterOtpVerify } from './mobile-auth-credentials.service.js';

const baseConfig = {
  otp: { length: 6 },
} as AppConfig;

function mockIdentity(): IdentityAuthService {
  return {
    mobileOtp: {
      request: vi.fn(),
      verify: vi.fn(),
    },
  } as unknown as IdentityAuthService;
}

describe('AuthService (P1-10 facade)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates requestOtp to identity.mobileOtp', async () => {
    const identity = mockIdentity();
    vi.mocked(identity.mobileOtp.request).mockResolvedValue({ ok: true });

    const svc = new AuthService(identity, baseConfig);
    const result = await svc.requestOtp('01711223344');

    expect(identity.mobileOtp.request).toHaveBeenCalledWith('01711223344');
    expect(result.success).toBe(true);
  });

  it('propagates OTP request failure codes', async () => {
    const identity = mockIdentity();
    vi.mocked(identity.mobileOtp.request).mockResolvedValue({
      ok: false,
      code: 'OTP_COOLDOWN',
      httpStatus: 429,
      message: 'Wait',
    });

    const svc = new AuthService(identity, baseConfig);
    const result = await svc.requestOtp('01711223344');

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('OTP_COOLDOWN');
    expect(result.httpStatus).toBe(429);
  });

  it('delegates verifyOtp to identity + shared credential helper', async () => {
    const identity = mockIdentity();
    vi.mocked(identity.mobileOtp.verify).mockResolvedValue({
      ok: true,
      userId: 'user-1',
      isNewUser: false,
    });
    vi.mocked(issueCredentialsAfterOtpVerify).mockResolvedValue({
      tokens: {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 3600,
      },
      user: { id: 'user-1', phone: '8801711223344', isNewUser: false },
    });

    const svc = new AuthService(identity, baseConfig);
    const result = await svc.verifyOtp('01711223344', '123456');

    expect(identity.mobileOtp.verify).toHaveBeenCalledWith('01711223344', '123456');
    expect(issueCredentialsAfterOtpVerify).toHaveBeenCalledWith(
      'user-1',
      '01711223344',
      false,
    );
    expect(result.success).toBe(true);
    expect(result.tokens?.accessToken).toBe('at');
  });
});
