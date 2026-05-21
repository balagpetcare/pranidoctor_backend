import type { LoginMethod, SocialProvider } from '../identity.types.js';

export type OtpRequestInput = {
  phone: string;
  locale?: string;
};

export type OtpVerifyInput = {
  phone: string;
  code: string;
  deviceKey?: string;
  platform?: string;
};

export type OtpRequestResult = {
  ok: boolean;
  cooldownSeconds?: number;
  errorCode?: string;
};

export type OtpVerifyResult = {
  ok: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  errorCode?: string;
};

export interface OtpAuthProvider {
  readonly method: LoginMethod;
  requestOtp(input: OtpRequestInput): Promise<OtpRequestResult>;
  verifyOtp(input: OtpVerifyInput): Promise<OtpVerifyResult>;
}

export type EmailLoginInput = {
  email: string;
  password: string;
  channel: 'admin_panel' | 'doctor_panel' | 'technician_panel';
};

export type EmailLoginResult = {
  ok: boolean;
  userId?: string;
  sessionId?: string;
  errorCode?: string;
};

export interface EmailAuthProvider {
  readonly method: LoginMethod;
  login(input: EmailLoginInput): Promise<EmailLoginResult>;
}

export type SocialLoginInput = {
  provider: SocialProvider;
  idToken: string;
};

export type SocialLoginResult = {
  ok: boolean;
  userId?: string;
  errorCode?: string;
  message?: string;
};

export interface SocialAuthProvider {
  readonly method: LoginMethod;
  login(input: SocialLoginInput): Promise<SocialLoginResult>;
}
