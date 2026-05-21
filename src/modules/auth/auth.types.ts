export interface OtpChallenge {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
  role: string;
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OtpRequestResult {
  success: boolean;
  maskedPhone: string;
  expiresIn: number;
  cooldownSeconds: number;
  /** Set when `success` is false — maps to foundation HTTP errors (P1-10). */
  failureCode?: string;
  httpStatus?: number;
  failureMessage?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  tokens?: AuthTokens;
  user?: {
    id: string;
    phone: string;
    isNewUser: boolean;
  };
  failureCode?: string;
  httpStatus?: number;
  failureMessage?: string;
}

export type AuthContext = 'mobile' | 'admin' | 'doctor' | 'technician';
