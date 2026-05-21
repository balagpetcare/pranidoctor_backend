import type { AppConfig } from '../../config/config.schema.js';
import type { AuthContext } from '../types.js';

export interface JwtConfig {
  secret: string;
  accessTokenTTL: number;
  refreshTokenTTL: number;
  issuer: string;
  audience: string;
}

export const TOKEN_TTL = {
  MOBILE_ACCESS: 15 * 60,
  MOBILE_REFRESH: 30 * 24 * 60 * 60,
  ADMIN_ACCESS: 30 * 60,
  ADMIN_REFRESH: 7 * 24 * 60 * 60,
  DOCTOR_ACCESS: 60 * 60,
  DOCTOR_REFRESH: 14 * 24 * 60 * 60,
  TECHNICIAN_ACCESS: 8 * 60 * 60,
  TECHNICIAN_REFRESH: 30 * 24 * 60 * 60,
  API_ACCESS: 60 * 60,
} as const;

export function getJwtConfigForContext(config: AppConfig, context: AuthContext): JwtConfig {
  switch (context) {
    case 'mobile':
      return {
        secret: config.jwt.mobileSecret,
        accessTokenTTL: TOKEN_TTL.MOBILE_ACCESS,
        refreshTokenTTL: TOKEN_TTL.MOBILE_REFRESH,
        issuer: 'pranidoctor',
        audience: 'mobile-app',
      };
    case 'admin':
      return {
        secret: config.jwt.adminSecret,
        accessTokenTTL: TOKEN_TTL.ADMIN_ACCESS,
        refreshTokenTTL: TOKEN_TTL.ADMIN_REFRESH,
        issuer: 'pranidoctor',
        audience: 'admin-panel',
      };
    case 'doctor':
      return {
        secret: config.jwt.doctorSecret,
        accessTokenTTL: TOKEN_TTL.DOCTOR_ACCESS,
        refreshTokenTTL: TOKEN_TTL.DOCTOR_REFRESH,
        issuer: 'pranidoctor',
        audience: 'doctor-app',
      };
    case 'technician':
      return {
        secret: config.jwt.technicianSecret,
        accessTokenTTL: TOKEN_TTL.TECHNICIAN_ACCESS,
        refreshTokenTTL: TOKEN_TTL.TECHNICIAN_REFRESH,
        issuer: 'pranidoctor',
        audience: 'technician-app',
      };
    case 'api':
      return {
        secret: config.jwt.adminSecret,
        accessTokenTTL: TOKEN_TTL.API_ACCESS,
        refreshTokenTTL: 0,
        issuer: 'pranidoctor',
        audience: 'api',
      };
    default:
      throw new Error(`Unknown auth context: ${context}`);
  }
}
