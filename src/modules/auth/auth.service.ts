/**
 * Foundation auth facade — delegates to IdentityAuthService + token services only.
 * Production mobile/panel traffic uses compat adapters (P1-10).
 */
import type { AppConfig } from '../../shared/config/config.schema.js';
import { logInfo } from '../../shared/logger/logger.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import { getOtpConfig } from '../../legacy/web/lib/mobile-auth/otp-env.js';

import type { AuthTokens, AuthContext, OtpRequestResult, OtpVerifyResult } from './auth.types.js';
import { getIdentityAuthService } from './identity-auth.service.js';
import type { IdentityAuthService } from './identity-auth.service.js';
import { maskBdMobilePhone } from './identity-core.js';
import {
  issueCredentialsAfterOtpVerify,
  logoutAllForUser,
} from './mobile-auth-credentials.service.js';
import { getRefreshTokenService } from './refresh-token.service.js';
import {
  authRequestContext,
  recordAuthAuditFireAndForget,
} from './auth-audit.service.js';
import { AuthAuditAction } from '../../generated/prisma/index.js';
import { AUTH_CHANNELS } from './identity-core.js';

export interface AuthServiceInterface extends ModuleService {
  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(phone: string, code: string): Promise<OtpVerifyResult>;
  refreshToken(refreshToken: string, context: AuthContext): Promise<AuthTokens | null>;
  revokeToken(userId: string): Promise<void>;
}

export class AuthService implements AuthServiceInterface {
  readonly name = 'AuthService';

  constructor(
    private readonly identity: IdentityAuthService,
    _config: AppConfig,
  ) {
    logInfo('AuthService initialized (P1-10 foundation facade)');
  }

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const cfg = getOtpConfig();
    const result = await this.identity.mobileOtp.request(phone);
    const masked = maskBdMobilePhone(phone);

    if (!result.ok) {
      return {
        success: false,
        maskedPhone: masked,
        expiresIn: 0,
        cooldownSeconds: cfg.resendCooldownSeconds,
        failureCode: result.code,
        httpStatus: result.httpStatus,
        failureMessage: result.message,
      };
    }

    return {
      success: true,
      maskedPhone: masked,
      expiresIn: cfg.ttlSeconds,
      cooldownSeconds: cfg.resendCooldownSeconds,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<OtpVerifyResult> {
    const verified = await this.identity.mobileOtp.verify(phone, code);
    if (!verified.ok) {
      return {
        success: false,
        failureCode: verified.code,
        httpStatus: verified.httpStatus,
        failureMessage: verified.message,
      };
    }

    try {
      const payload = await issueCredentialsAfterOtpVerify(
        verified.userId,
        phone,
        verified.isNewUser,
      );
      return { success: true, ...payload };
    } catch {
      return { success: false, failureCode: 'SERVER_MISCONFIGURED', httpStatus: 500 };
    }
  }

  async refreshToken(refreshToken: string, _context: AuthContext): Promise<AuthTokens | null> {
    const ctx = authRequestContext();
    const rotated = await getRefreshTokenService().rotate(refreshToken, ctx);
    if (!rotated) {
      return null;
    }
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      expiresIn: rotated.expiresIn,
    };
  }

  async revokeToken(userId: string): Promise<void> {
    recordAuthAuditFireAndForget({
      action: AuthAuditAction.LOGOUT,
      channel: AUTH_CHANNELS.mobile,
      userId,
    });
    await logoutAllForUser(userId, AUTH_CHANNELS.mobile);
    logInfo(`Auth logout complete userId=${userId}`);
  }
}

export function createAuthService(config: AppConfig): AuthService {
  return new AuthService(getIdentityAuthService(), config);
}
