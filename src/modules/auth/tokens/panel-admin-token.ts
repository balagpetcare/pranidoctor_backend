import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_SESSION_COOKIE = 'prani_admin_token';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ALG = 'HS256';

export function getAdminJwtSecret(): string | null {
  const raw =
    process.env.ADMIN_JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!raw) return null;
  const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
  if (raw.length < minLen) return null;
  return raw;
}

export type AdminPanelSessionRole = 'ADMIN' | 'SUPER_ADMIN';

export type AdminJwtPayload = {
  sub: string;
  email: string;
  role: AdminPanelSessionRole;
  sid?: string;
};

function getEncodedSecret(): Uint8Array {
  const secret = getAdminJwtSecret();
  if (!secret) {
    throw new Error(
      'ADMIN_JWT_SECRET, AUTH_SECRET, or JWT_SECRET must be set (≥32 chars in production, ≥16 in development)',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(
  userId: string,
  email: string,
  role: AdminPanelSessionRole,
  sessionId?: string,
): Promise<string> {
  const secret = getEncodedSecret();
  const claims: { role: AdminPanelSessionRole; email: string; sid?: string } = { role, email };
  if (sessionId) claims.sid = sessionId;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  try {
    const secret = getAdminJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALG],
    });
    const role = payload.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') return null;
    if (typeof payload.sub !== 'string') return null;
    if (typeof payload.email !== 'string') return null;
    const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
    return {
      sub: payload.sub,
      email: payload.email,
      role: role as AdminPanelSessionRole,
      ...(sid ? { sid } : {}),
    };
  } catch {
    return null;
  }
}
