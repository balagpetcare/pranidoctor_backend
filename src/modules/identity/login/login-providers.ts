import { getIdentityAuthService } from '../../auth/identity-auth.service.js';
import { issueCredentialsAfterOtpVerify } from '../../auth/mobile-auth-credentials.service.js';
import { getOtpConfig } from '../../../legacy/web/lib/mobile-auth/otp-env.js';

import type {
  EmailAuthProvider,
  EmailLoginInput,
  EmailLoginResult,
  OtpAuthProvider,
  OtpRequestInput,
  OtpRequestResult,
  OtpVerifyInput,
  OtpVerifyResult,
  SocialAuthProvider,
  SocialLoginResult,
} from './login-provider.types.js';

/** Delegates mobile OTP to frozen IdentityAuthService — no OTP logic duplicated. */
export class DelegateOtpProvider implements OtpAuthProvider {
  readonly method = 'mobile_otp' as const;

  async requestOtp(input: OtpRequestInput): Promise<OtpRequestResult> {
    const svc = getIdentityAuthService().mobileOtp;
    const result = await svc.request(input.phone);
    if (result.ok) {
      return { ok: true, cooldownSeconds: getOtpConfig().resendCooldownSeconds };
    }
    return { ok: false, errorCode: result.code ?? 'OTP_REQUEST_FAILED' };
  }

  async verifyOtp(input: OtpVerifyInput): Promise<OtpVerifyResult> {
    const svc = getIdentityAuthService().mobileOtp;
    const result = await svc.verify(input.phone, input.code);

    if (!result.ok) {
      return { ok: false, errorCode: result.code ?? 'OTP_VERIFY_FAILED' };
    }

    try {
      const device =
        input.deviceKey != null
          ? input.platform != null
            ? { deviceKey: input.deviceKey, platform: input.platform }
            : { deviceKey: input.deviceKey }
          : undefined;
      const credentials = await issueCredentialsAfterOtpVerify(
        result.userId,
        input.phone,
        result.isNewUser,
        undefined,
        device,
      );
      return {
        ok: true,
        userId: result.userId,
        accessToken: credentials.tokens.accessToken,
        refreshToken: credentials.tokens.refreshToken,
      };
    } catch {
      return { ok: false, errorCode: 'SERVER_MISCONFIGURED' };
    }
  }
}

/** Panel email login via frozen panel auth services. */
export class PanelEmailAuthProvider implements EmailAuthProvider {
  readonly method = 'email' as const;

  async login(input: EmailLoginInput): Promise<EmailLoginResult> {
    const identity = getIdentityAuthService();

    try {
      if (input.channel === 'admin_panel') {
        const result = await identity.admin.login({
          email: input.email,
          password: input.password,
        });
        return result.ok
          ? { ok: true, userId: result.value.user.id }
          : { ok: false, errorCode: result.error.code ?? 'LOGIN_FAILED' };
      }

      if (input.channel === 'doctor_panel') {
        const result = await identity.doctor.login({
          email: input.email,
          password: input.password,
        });
        return result.ok
          ? { ok: true, userId: result.user.id }
          : { ok: false, errorCode: result.code ?? 'LOGIN_FAILED' };
      }

      if (input.channel === 'technician_panel') {
        const result = await identity.technician.login({
          email: input.email,
          password: input.password,
        });
        return result.ok
          ? { ok: true, userId: result.user.id }
          : { ok: false, errorCode: result.code ?? 'LOGIN_FAILED' };
      }

      return { ok: false, errorCode: 'UNSUPPORTED_CHANNEL' };
    } catch {
      return { ok: false, errorCode: 'LOGIN_FAILED' };
    }
  }
}

export class StubSocialAuthProvider implements SocialAuthProvider {
  readonly method = 'social' as const;

  async login(): Promise<SocialLoginResult> {
    return {
      ok: false,
      errorCode: 'NOT_IMPLEMENTED',
      message: 'Social login reserved — provider abstraction only (no OAuth routes in freeze)',
    };
  }
}

let otpProvider: DelegateOtpProvider | null = null;
let emailProvider: PanelEmailAuthProvider | null = null;
let socialProvider: StubSocialAuthProvider | null = null;

export function getDelegateOtpProvider(): DelegateOtpProvider {
  if (!otpProvider) otpProvider = new DelegateOtpProvider();
  return otpProvider;
}

export function getPanelEmailAuthProvider(): PanelEmailAuthProvider {
  if (!emailProvider) emailProvider = new PanelEmailAuthProvider();
  return emailProvider;
}

export function getStubSocialAuthProvider(): StubSocialAuthProvider {
  if (!socialProvider) socialProvider = new StubSocialAuthProvider();
  return socialProvider;
}
