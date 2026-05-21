import type { Request, Response, NextFunction } from 'express';

import type { AppConfig } from '../../shared/config/config.schema.js';
import { BadRequestError } from '../../shared/errors/index.js';

import { toOtpRequestResponseDto, toOtpVerifyResponseDto, toRefreshTokenResponseDto } from './auth.dto.js';
import type { AuthServiceInterface } from './auth.service.js';
import {
  throwOtpRequestFailure,
  throwOtpVerifyFailure,
} from './foundation-auth.mapper.js';
import { resolveFoundationLogoutUserId } from './foundation-logout.helper.js';
import type { RequestOtpInput, VerifyOtpInput, RefreshTokenInput } from './auth.validator.js';

export class AuthController {
  constructor(
    private readonly authService: AuthServiceInterface,
    private readonly config: AppConfig
  ) {}

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.body as RequestOtpInput;

      const result = await this.authService.requestOtp(phone);

      if (!result.success) {
        throwOtpRequestFailure(result);
      }

      const response = toOtpRequestResponseDto(result, this.config.otp.length);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, code } = req.body as VerifyOtpInput;

      const result = await this.authService.verifyOtp(phone, code);

      if (!result.success) {
        throwOtpVerifyFailure(result);
      }

      const response = toOtpVerifyResponseDto(result);
      if (!response) {
        throw new BadRequestError('OTP_INVALID', 'Invalid or expired OTP');
      }
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;

      const tokens = await this.authService.refreshToken(refreshToken, 'mobile');

      if (!tokens) {
        throw new BadRequestError('TOKEN_INVALID', 'Invalid refresh token');
      }

      const response = toRefreshTokenResponseDto(tokens);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = await resolveFoundationLogoutUserId(req);

      if (userId) {
        await this.authService.revokeToken(userId);
      }

      res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
      next(error);
    }
  };
}
