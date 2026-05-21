import * as jose from 'jose';
import { nanoid } from 'nanoid';

import { getConfig } from '../../config/index.js';
import { logDebug, logWarn } from '../../logger/logger.js';
import type { AuthContext, TokenPayload, UserRole } from '../types.js';

import { getJwtConfigForContext } from './jwt.config.js';

export interface GenerateTokenOptions {
  userId: string;
  role: UserRole;
  context: AuthContext;
  sessionId: string;
  deviceId?: string;
  tenantId?: string;
  additionalClaims?: Record<string, unknown>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  sessionId: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
  expired?: boolean;
}

async function createToken(
  payload: Record<string, unknown>,
  secret: string,
  ttl: number,
  issuer: string,
  audience: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secretKey);

  return jwt;
}

async function verifyToken(
  token: string,
  secret: string,
  issuer: string,
  audience: string
): Promise<jose.JWTPayload> {
  const secretKey = new TextEncoder().encode(secret);

  const { payload } = await jose.jwtVerify(token, secretKey, {
    issuer,
    audience,
  });

  return payload;
}

export async function generateTokenPair(options: GenerateTokenOptions): Promise<TokenPair> {
  const config = getConfig();
  const jwtConfig = getJwtConfigForContext(config, options.context);

  const now = Math.floor(Date.now() / 1000);
  const sessionId = options.sessionId || nanoid(21);

  const accessPayload: Record<string, unknown> = {
    sub: options.userId,
    type: 'access',
    ctx: options.context,
    role: options.role,
    sid: sessionId,
    ...(options.deviceId && { did: options.deviceId }),
    ...(options.tenantId && { tid: options.tenantId }),
    ...options.additionalClaims,
  };

  const refreshPayload: Record<string, unknown> = {
    sub: options.userId,
    type: 'refresh',
    ctx: options.context,
    role: options.role,
    sid: sessionId,
    ...(options.deviceId && { did: options.deviceId }),
    ...(options.tenantId && { tid: options.tenantId }),
    jti: nanoid(16),
  };

  const [accessToken, refreshToken] = await Promise.all([
    createToken(accessPayload, jwtConfig.secret, jwtConfig.accessTokenTTL, jwtConfig.issuer, jwtConfig.audience),
    createToken(refreshPayload, jwtConfig.secret, jwtConfig.refreshTokenTTL, jwtConfig.issuer, jwtConfig.audience),
  ]);

  logDebug('Token pair generated', {
    userId: options.userId,
    context: options.context,
    sessionId,
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date((now + jwtConfig.accessTokenTTL) * 1000),
    refreshTokenExpiresAt: new Date((now + jwtConfig.refreshTokenTTL) * 1000),
    sessionId,
  };
}

export async function generateAccessToken(options: GenerateTokenOptions): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const config = getConfig();
  const jwtConfig = getJwtConfigForContext(config, options.context);

  const now = Math.floor(Date.now() / 1000);

  const accessPayload: Record<string, unknown> = {
    sub: options.userId,
    type: 'access',
    ctx: options.context,
    role: options.role,
    sid: options.sessionId,
    ...(options.deviceId && { did: options.deviceId }),
    ...(options.tenantId && { tid: options.tenantId }),
    ...options.additionalClaims,
  };

  const accessToken = await createToken(
    accessPayload,
    jwtConfig.secret,
    jwtConfig.accessTokenTTL,
    jwtConfig.issuer,
    jwtConfig.audience
  );

  return {
    accessToken,
    expiresAt: new Date((now + jwtConfig.accessTokenTTL) * 1000),
  };
}

export async function validateAccessToken(
  token: string,
  context: AuthContext
): Promise<ValidateTokenResult> {
  const config = getConfig();
  const jwtConfig = getJwtConfigForContext(config, context);

  try {
    const payload = await verifyToken(token, jwtConfig.secret, jwtConfig.issuer, jwtConfig.audience);

    if (payload['type'] !== 'access') {
      return { valid: false, error: 'Invalid token type' };
    }

    return {
      valid: true,
      payload: payload as unknown as TokenPayload,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      logDebug('Access token expired', { context });
      return { valid: false, error: 'Token expired', expired: true };
    }

    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      logWarn('Token claim validation failed', { context, error: String(error) });
      return { valid: false, error: 'Invalid token claims' };
    }

    logWarn('Token validation failed', { context, error: String(error) });
    return { valid: false, error: 'Invalid token' };
  }
}

export async function validateRefreshToken(
  token: string,
  context: AuthContext
): Promise<ValidateTokenResult> {
  const config = getConfig();
  const jwtConfig = getJwtConfigForContext(config, context);

  try {
    const payload = await verifyToken(token, jwtConfig.secret, jwtConfig.issuer, jwtConfig.audience);

    if (payload['type'] !== 'refresh') {
      return { valid: false, error: 'Invalid token type' };
    }

    return {
      valid: true,
      payload: payload as unknown as TokenPayload,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: 'Refresh token expired', expired: true };
    }

    return { valid: false, error: 'Invalid refresh token' };
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}
