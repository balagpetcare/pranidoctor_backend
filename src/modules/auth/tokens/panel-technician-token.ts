import { SignJWT, jwtVerify } from 'jose';

export const TECHNICIAN_SESSION_COOKIE = 'prani_technician_session';
export const TECHNICIAN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ALG = 'HS256';

export function getTechnicianJwtSecret(): string | null {
  const raw =
    process.env.TECHNICIAN_JWT_SECRET?.trim() ||
    process.env.DOCTOR_JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!raw) return null;
  const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
  if (raw.length < minLen) return null;
  return raw;
}

export type TechnicianJwtPayload = {
  sub: string;
  email: string;
  role: 'AI_TECHNICIAN';
  sid?: string;
};

function getEncodedSecret(): Uint8Array {
  const secret = getTechnicianJwtSecret();
  if (!secret) {
    throw new Error(
      'TECHNICIAN_JWT_SECRET, DOCTOR_JWT_SECRET, or AUTH_SECRET must be set and at least 32 characters long',
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signTechnicianToken(
  userId: string,
  email: string,
  sessionId?: string,
): Promise<string> {
  const secret = getEncodedSecret();
  const claims: { role: 'AI_TECHNICIAN'; email: string; sid?: string } = {
    role: 'AI_TECHNICIAN',
    email,
  };
  if (sessionId) claims.sid = sessionId;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TECHNICIAN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyTechnicianToken(
  token: string,
): Promise<TechnicianJwtPayload | null> {
  try {
    const secret = getTechnicianJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALG],
    });
    if (payload.role !== 'AI_TECHNICIAN') return null;
    if (typeof payload.sub !== 'string') return null;
    if (typeof payload.email !== 'string') return null;
    const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
    return {
      sub: payload.sub,
      email: payload.email,
      role: 'AI_TECHNICIAN',
      ...(sid ? { sid } : {}),
    };
  } catch {
    return null;
  }
}
