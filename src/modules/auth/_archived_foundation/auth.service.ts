import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { nanoid } from 'nanoid';

import type { AppConfig } from '../../shared/config/config.schema.js';
import type { ModuleService } from '../../shared/module/module.types.js';
import {
  generateTokenPair,
  validateRefreshToken,
  type TokenPair,
} from '../../shared/security/jwt/jwt.service.js';
import { getJwtConfigForContext } from '../../shared/security/jwt/jwt.config.js';
import {
  createSession as createRedisSession,
  revokeAllUserSessions as revokeAllRedisSessions,
  revokeSession as revokeRedisSession,
  storeRefreshToken as storeRedisRefreshToken,
  validateRefreshTokenStorage,
  rotateRefreshToken as rotateRedisRefreshToken,
} from '../../shared/security/session/session.storage.js';
import type { AuthContext as SecurityAuthContext } from '../../shared/security/types.js';

import { authEvents } from './auth.events.js';
import { AuthRepository, hashTokenValue, type AuthRepositoryInterface } from './auth.repository.js';
import type { AuthTokens, OtpRequestResult, OtpVerifyResult, AuthContext } from './auth.types.js';

export interface AuthServiceInterface extends ModuleService {
  requestOtp(phone: string): Promise<OtpRequestResult>;
  verifyOtp(phone: string, code: string, deviceId?: string): Promise<OtpVerifyResult>;
  refreshToken(refreshToken: string, context: AuthContext): Promise<AuthTokens | null>;
  revokeToken(userId: string, sessionId?: string): Promise<void>;
  validateToken(token: string, context: AuthContext): Promise<boolean>;
}

function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function verifyOtpHash(code: string, codeHash: string): boolean {
  const computed = hashOtpCode(code);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(codeHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function toAuthTokens(pair: TokenPair): AuthTokens {
  const expiresIn = Math.max(
    0,
    Math.floor((pair.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
  );
  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    expiresIn,
  };
}

function mapAuthContext(context: AuthContext): SecurityAuthContext {
  return context;
}

export class AuthService implements AuthServiceInterface {
  readonly name = 'AuthService';

  constructor(
    private readonly repository: AuthRepositoryInterface,
    private readonly config: AppConfig
  ) {}

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.repository.countRecentOtpRequests(phone, since);

    if (recentCount >= this.config.otp.maxSendsPerHour) {
      return {
        success: false,
        maskedPhone: this.maskPhone(phone),
        expiresIn: 0,
        cooldownSeconds: this.config.otp.resendCooldownSeconds,
      };
    }

    const code = String(randomInt(0, 10 ** this.config.otp.length)).padStart(
      this.config.otp.length,
      '0'
    );
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + this.config.otp.expirySeconds * 1000);

    await this.repository.createOtpChallenge(phone, codeHash, expiresAt);

    await authEvents.emitOtpRequested({
      phone,
      requestId: nanoid(12),
      timestamp: new Date(),
    });

    if (this.config.nodeEnv === 'development') {
      console.info(`[DEV] OTP for ${phone}: ${code}`);
    }

    return {
      success: true,
      maskedPhone: this.maskPhone(phone),
      expiresIn: this.config.otp.expirySeconds,
      cooldownSeconds: this.config.otp.resendCooldownSeconds,
    };
  }

  async verifyOtp(
    phone: string,
    code: string,
    deviceId?: string
  ): Promise<OtpVerifyResult> {
    const challenge = await this.repository.findOtpChallenge(phone);

    if (!challenge || challenge.verified) {
      return { success: false };
    }

    if (challenge.expiresAt < new Date()) {
      await this.repository.deleteOtpChallenge(phone);
      return { success: false };
    }

    if (challenge.attempts >= this.config.otp.maxAttempts) {
      return { success: false };
    }

    if (!verifyOtpHash(code, challenge.codeHash)) {
      await this.repository.incrementOtpAttempts(challenge.id, phone);
      return { success: false };
    }

    await this.repository.markOtpVerified(challenge.id, phone);

    let user = await this.repository.findUserByPhone(phone);
    const isNewUser = !user;

    if (!user) {
      user = await this.repository.createUser({
        phone,
        status: 'ACTIVE',
        role: 'USER',
      });
    }

    const securityContext: SecurityAuthContext = 'mobile';
    const jwtConfig = getJwtConfigForContext(this.config, securityContext);

    const redisSession = await createRedisSession({
      userId: user.id,
      context: securityContext,
      ttlSeconds: jwtConfig.refreshTokenTTL,
      ...(deviceId !== undefined ? { deviceId } : {}),
    });

    await this.repository.createSession({
      id: redisSession.id,
      userId: user.id,
      context: securityContext,
      expiresAt: redisSession.expiresAt,
      mfaVerified: true,
      mfaMethod: 'otp',
      ...(deviceId !== undefined ? { deviceId } : {}),
    });

    const tokenPair = await generateTokenPair({
      userId: user.id,
      role: user.role,
      context: securityContext,
      sessionId: redisSession.id,
      ...(deviceId !== undefined ? { deviceId } : {}),
      ...(user.tenantId !== null && user.tenantId !== undefined
        ? { tenantId: user.tenantId }
        : {}),
    });

    await storeRedisRefreshToken({
      userId: user.id,
      sessionId: redisSession.id,
      token: tokenPair.refreshToken,
      ttlSeconds: jwtConfig.refreshTokenTTL,
      ...(deviceId !== undefined ? { deviceId } : {}),
    });

    await this.repository.storeRefreshToken({
      userId: user.id,
      sessionId: redisSession.id,
      tokenHash: hashTokenValue(tokenPair.refreshToken),
      expiresAt: tokenPair.refreshTokenExpiresAt,
      ...(deviceId !== undefined ? { deviceId } : {}),
    });

    await this.repository.touchLastLogin(user.id);
    await this.repository.deleteOtpChallenge(phone);

    await authEvents.emitOtpVerified({
      userId: user.id,
      phone,
      isNewUser,
      timestamp: new Date(),
    });

    return {
      success: true,
      tokens: toAuthTokens(tokenPair),
      user: {
        id: user.id,
        phone: user.phone ?? phone,
        isNewUser,
      },
    };
  }

  async refreshToken(refreshToken: string, context: AuthContext): Promise<AuthTokens | null> {
    const securityContext = mapAuthContext(context);
    const validation = await validateRefreshToken(refreshToken, securityContext);

    if (!validation.valid || !validation.payload) {
      return null;
    }

    const { sub: userId, sid: sessionId } = validation.payload;

    const storageCheck = await validateRefreshTokenStorage(userId, sessionId, refreshToken);
    if (!storageCheck.valid) {
      const dbToken = await this.repository.findRefreshTokenByHash(
        hashTokenValue(refreshToken)
      );
      if (!dbToken || dbToken.revoked) {
        return null;
      }
    }

    const user = await this.repository.findUserById(userId);
    if (!user) {
      return null;
    }

    const session = await this.repository.findSessionById(sessionId);
    if (!session || session.status !== 'ACTIVE' || session.expiresAt < new Date()) {
      return null;
    }

    const jwtConfig = getJwtConfigForContext(this.config, securityContext);
    const tokenPair = await generateTokenPair({
      userId: user.id,
      role: user.role,
      context: securityContext,
      sessionId,
      ...(validation.payload.did !== undefined ? { deviceId: validation.payload.did } : {}),
      ...(user.tenantId !== null && user.tenantId !== undefined
        ? { tenantId: user.tenantId }
        : {}),
    });

    const activeDbToken = await this.repository.findActiveRefreshTokenForSession(
      userId,
      sessionId
    );

    if (activeDbToken) {
      await this.repository.rotateRefreshToken({
        oldTokenId: activeDbToken.id,
        newTokenHash: hashTokenValue(tokenPair.refreshToken),
        newExpiresAt: tokenPair.refreshTokenExpiresAt,
        ...(validation.payload.did !== undefined
          ? { deviceId: validation.payload.did }
          : {}),
      });
    } else {
      await this.repository.storeRefreshToken({
        userId,
        sessionId,
        tokenHash: hashTokenValue(tokenPair.refreshToken),
        expiresAt: tokenPair.refreshTokenExpiresAt,
        ...(validation.payload.did !== undefined
          ? { deviceId: validation.payload.did }
          : {}),
      });
    }

    await rotateRedisRefreshToken(
      userId,
      sessionId,
      tokenPair.refreshToken,
      jwtConfig.refreshTokenTTL
    );

    await this.repository.updateSessionActivity(sessionId);

    return toAuthTokens(tokenPair);
  }

  async revokeToken(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await revokeRedisSession(sessionId, 'User logout');
      await this.repository.revokeSession(sessionId, 'User logout');
      await this.repository.revokeRefreshTokensForSession(userId, sessionId);
      return;
    }

    await revokeAllRedisSessions(userId, undefined, 'User logout');
    await this.repository.revokeAllSessionsForUser(userId, undefined, 'User logout');
    await this.repository.revokeAllRefreshTokensForUser(userId);
  }

  async validateToken(token: string, context: AuthContext): Promise<boolean> {
    const { validateAccessToken } = await import('../../shared/security/jwt/jwt.service.js');
    const result = await validateAccessToken(token, mapAuthContext(context));
    return result.valid;
  }

  private maskPhone(phone: string): string {
    if (phone.length < 8) return '****';
    const visible = phone.slice(-4);
    const masked = '*'.repeat(phone.length - 4);
    return masked + visible;
  }
}

export function createAuthService(config: AppConfig): AuthService {
  return new AuthService(new AuthRepository(), config);
}
