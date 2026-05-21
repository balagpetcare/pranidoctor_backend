export type AuthContext = 'mobile' | 'admin' | 'doctor' | 'technician' | 'api';

export type UserRole =
  | 'USER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'DOCTOR'
  | 'TECHNICIAN'
  | 'SUPPORT'
  | 'MANAGER';

export const RoleHierarchy: Record<UserRole, number> = {
  USER: 1,
  SUPPORT: 2,
  TECHNICIAN: 3,
  DOCTOR: 4,
  MANAGER: 5,
  ADMIN: 6,
  SUPER_ADMIN: 7,
};

export interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  role: UserRole;
  tenantId?: string;
  sessionId: string;
  deviceId?: string;
}

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  ctx: AuthContext;
  role: UserRole;
  sid: string;
  did?: string;
  tid?: string;
  iat: number;
  exp: number;
}

export interface MobileTokenPayload extends TokenPayload {
  phone: string;
}

export interface AdminTokenPayload extends TokenPayload {
  email: string;
  permissions: string[];
}

export interface DoctorTokenPayload extends TokenPayload {
  doctorId: string;
  clinicId?: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  platform: 'ios' | 'android' | 'web' | 'unknown';
  appVersion?: string;
  osVersion?: string;
  deviceName?: string;
  pushToken?: string;
}

export interface SessionData {
  id: string;
  userId: string;
  context: AuthContext;
  deviceId?: string;
  deviceInfo?: DeviceInfo;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  mfaVerified?: boolean;
  mfaMethod?: 'otp' | 'totp' | 'biometric';
}

export interface RefreshTokenData {
  id: string;
  userId: string;
  sessionId: string;
  tokenHash: string;
  deviceId?: string;
  expiresAt: Date;
  rotatedAt?: Date;
  rotatedToId?: string;
  revoked: boolean;
}
