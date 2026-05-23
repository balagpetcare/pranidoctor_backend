import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

export const MOBILE_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const ALG = 'HS256';
/** Matches `jwt.config.ts` mobile context (`mobile-app`). */
export const MOBILE_AUDIENCE =
  process.env.MOBILE_JWT_AUDIENCE?.trim() || 'mobile-app';
/** Legacy OTP tokens before STABILITY auth alignment. */
const MOBILE_LEGACY_AUDIENCE = 'mobile';
const MOBILE_ISSUER =
  process.env.MOBILE_JWT_ISSUER?.trim() || 'pranidoctor';

export function getMobileJwtSecret(): string | null {
  const raw =
    process.env.MOBILE_JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!raw) return null;
  const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
  if (raw.length < minLen) return null;
  return raw;
}

export type MobileJwtPayload = {
  sub: string;
  role: 'CUSTOMER';
  sid?: string;
};

function getEncodedSecret(): Uint8Array {
  const secret = getMobileJwtSecret();
  if (!secret) {
    throw new Error(
      'Mobile JWT secret missing: set MOBILE_JWT_SECRET or AUTH_SECRET (32+ chars in production).',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signMobileCustomerToken(
  userId: string,
  sessionId?: string,
): Promise<string> {
  const secret = getEncodedSecret();
  const claims: {
    role: 'CUSTOMER';
    type: 'access';
    ctx: 'mobile';
    sid?: string;
  } = { role: 'CUSTOMER', type: 'access', ctx: 'mobile' };
  if (sessionId) {
    claims.sid = sessionId;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuer(MOBILE_ISSUER)
    .setAudience(MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_SESSION_MAX_AGE}s`)
    .sign(secret);
}

async function verifyPayload(
  token: string,
  secret: string,
  options: { issuer?: string; audience: string | string[] },
): Promise<MobileJwtPayload | null> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: [ALG],
    audience: options.audience,
    ...(options.issuer ? { issuer: options.issuer } : {}),
  });
  if (payload.role !== 'CUSTOMER') return null;
  if (typeof payload.sub !== 'string') return null;
  const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
  return { sub: payload.sub, role: 'CUSTOMER', ...(sid ? { sid } : {}) };
}

export async function verifyMobileJwt(token: string): Promise<MobileJwtPayload | null> {
  try {
    const secret = getMobileJwtSecret();
    if (!secret) return null;
    const audiences = [MOBILE_AUDIENCE, MOBILE_LEGACY_AUDIENCE];
    try {
      return await verifyPayload(token, secret, {
        issuer: MOBILE_ISSUER,
        audience: audiences,
      });
    } catch (error) {
      if (error instanceof joseErrors.JWTClaimValidationFailed) {
        // Tokens issued before issuer claim was added (STABILITY_01 migration).
        try {
          return await verifyPayload(token, secret, { audience: audiences });
        } catch (legacyError) {
          if (legacyError instanceof joseErrors.JWTClaimValidationFailed) {
            return null;
          }
          throw legacyError;
        }
      }
      throw error;
    }
  } catch {
    return null;
  }
}
