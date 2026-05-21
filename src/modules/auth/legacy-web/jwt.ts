/** @deprecated Re-export only — canonical: `modules/auth/tokens/mobile-jwt` (P1-10). */
export {
  getMobileJwtSecret,
  signMobileCustomerToken,
  verifyMobileJwt,
  MOBILE_SESSION_MAX_AGE,
  type MobileJwtPayload,
} from '../tokens/mobile-jwt.js';
