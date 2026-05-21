import type { AuthTokens, OtpRequestResult, OtpVerifyResult } from './auth.types.js';

export interface RequestOtpDto {
  phone: string;
}

export interface VerifyOtpDto {
  phone: string;
  code: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface OtpRequestResponseDto {
  success: boolean;
  data: {
    maskedPhone: string;
    otpLength: number;
    expiresIn: number;
    cooldownSeconds: number;
  };
}

export interface OtpVerifyResponseDto {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      id: string;
      phone: string;
      isNewUser: boolean;
    };
  };
}

export interface RefreshTokenResponseDto {
  success: boolean;
  data: {
    accessToken: string;
    expiresIn: number;
    /** Present when refresh rotation is enabled (P1-10 additive). */
    refreshToken?: string;
  };
}

export function toOtpRequestResponseDto(result: OtpRequestResult, otpLength: number): OtpRequestResponseDto {
  return {
    success: result.success,
    data: {
      maskedPhone: result.maskedPhone,
      otpLength,
      expiresIn: result.expiresIn,
      cooldownSeconds: result.cooldownSeconds,
    },
  };
}

export function toOtpVerifyResponseDto(result: OtpVerifyResult): OtpVerifyResponseDto | null {
  if (!result.success || !result.tokens || !result.user) {
    return null;
  }

  return {
    success: true,
    data: {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        isNewUser: result.user.isNewUser,
      },
    },
  };
}

export function toRefreshTokenResponseDto(tokens: AuthTokens): RefreshTokenResponseDto {
  return {
    success: true,
    data: {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    },
  };
}
