import type { AuthContext as SecurityAuthContext } from '../../shared/security/types.js';
import type { UserRole } from '../../shared/security/types.js';

import type { OtpChallenge } from './auth.types.js';

/** Re-export for repository consumers */
export type { OtpChallenge };

/** Login channel — extensible for social providers */
export type AuthLoginChannel = 'phone_otp' | 'email' | 'social';

/** Reserved for OAuth / OIDC (not persisted until social tables exist) */
export type SocialAuthProvider = 'google' | 'apple' | 'facebook';

export interface SocialIdentityLookup {
  provider: SocialAuthProvider;
  subject: string;
}

export interface AuthUserRecord {
  id: string;
  phone: string | null;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  status: string;
  tenantId: string | null;
  passwordHash: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAuthUserInput {
  phone?: string;
  email?: string;
  displayName?: string;
  passwordHash?: string;
  role?: UserRole;
  tenantId?: string;
  status?: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'INVITED';
}

export interface CreatePersistedSessionInput {
  id: string;
  userId: string;
  context: SecurityAuthContext;
  expiresAt: Date;
  deviceId?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
  deviceName?: string;
  pushToken?: string;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
  mfaVerified?: boolean;
  mfaMethod?: string;
}

export interface PersistedSessionRecord {
  id: string;
  userId: string;
  context: SecurityAuthContext;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  deviceId: string | null;
  expiresAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  tenantId: string | null;
  createdAt: Date;
}

export interface StoreRefreshTokenInput {
  userId: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
  deviceId?: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  deviceId: string | null;
  expiresAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
  rotatedAt: Date | null;
  rotatedToId: string | null;
}

export interface RotateRefreshTokenInput {
  oldTokenId: string;
  newTokenHash: string;
  newExpiresAt: Date;
  deviceId?: string;
}
