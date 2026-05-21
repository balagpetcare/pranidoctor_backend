import { SignJWT, jwtVerify } from 'jose';

export const MOBILE_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const ALG = 'HS256';
const MOBILE_AUDIENCE = 'mobile';

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
  const claims: { role: 'CUSTOMER'; sid?: string } = { role: 'CUSTOMER' };
  if (sessionId) {
    claims.sid = sessionId;
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setAudience(MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyMobileJwt(token: string): Promise<MobileJwtPayload | null> {
  try {
    const secret = getMobileJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALG],
      audience: MOBILE_AUDIENCE,
    });
    if (payload.role !== 'CUSTOMER') return null;
    if (typeof payload.sub !== 'string') return null;
    const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
    return { sub: payload.sub, role: 'CUSTOMER', ...(sid ? { sid } : {}) };
  } catch {
    return null;
  }
}
