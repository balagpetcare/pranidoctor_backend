import { MOBILE_SESSION_MAX_AGE } from './tokens/mobile-jwt.js';

export function isAuthRefreshEnabled(): boolean {
  const raw = process.env.AUTH_REFRESH_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

export function getRefreshTokenTtlSeconds(): number {
  const raw = process.env.REFRESH_TOKEN_TTL_SECONDS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return MOBILE_SESSION_MAX_AGE;
}

export function getRefreshTokenPepper(): string | null {
  const raw =
    process.env.MOBILE_REFRESH_SECRET?.trim() ||
    process.env.REFRESH_TOKEN_PEPPER?.trim() ||
    '';
  if (!raw) return null;
  const minLen = process.env.NODE_ENV === 'production' ? 32 : 16;
  if (raw.length < minLen) return null;
  return raw;
}
