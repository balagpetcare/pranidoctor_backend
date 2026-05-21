import { SignJWT, jwtVerify } from 'jose';

export const DOCTOR_SESSION_COOKIE = 'prani_doctor_session';
export const DOCTOR_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ALG = 'HS256';

export function getDoctorJwtSecret(): string | null {
  const raw =
    process.env.DOCTOR_JWT_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (!raw) return null;
  const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
  if (raw.length < minLen) return null;
  return raw;
}

export type DoctorJwtPayload = {
  sub: string;
  email: string;
  role: 'DOCTOR';
  sid?: string;
};

function getEncodedSecret(): Uint8Array {
  const secret = getDoctorJwtSecret();
  if (!secret) {
    throw new Error('DOCTOR_JWT_SECRET or AUTH_SECRET must be set and at least 32 characters long');
  }
  return new TextEncoder().encode(secret);
}

export async function signDoctorToken(
  userId: string,
  email: string,
  sessionId?: string,
): Promise<string> {
  const secret = getEncodedSecret();
  const claims: { role: 'DOCTOR'; email: string; sid?: string } = { role: 'DOCTOR', email };
  if (sessionId) claims.sid = sessionId;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${DOCTOR_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyDoctorToken(token: string): Promise<DoctorJwtPayload | null> {
  try {
    const secret = getDoctorJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: [ALG],
    });
    if (payload.role !== 'DOCTOR') return null;
    if (typeof payload.sub !== 'string') return null;
    if (typeof payload.email !== 'string') return null;
    const sid = typeof payload.sid === 'string' ? payload.sid : undefined;
    return { sub: payload.sub, email: payload.email, role: 'DOCTOR', ...(sid ? { sid } : {}) };
  } catch {
    return null;
  }
}
