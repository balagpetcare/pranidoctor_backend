import {
  BadRequestError,
  InternalServerError,
  TooManyRequestsError,
  ValidationError,
} from '../../shared/errors/index.js';

import type { OtpRequestResult, OtpVerifyResult } from './auth.types.js';

type OtpFailureLike = {
  code: string;
  httpStatus: number;
  message: string;
};

export function throwFromOtpFailure(failure: OtpFailureLike): never {
  const { code, httpStatus, message } = failure;
  if (httpStatus === 429) {
    throw new TooManyRequestsError(code, message);
  }
  if (httpStatus === 422) {
    throw new ValidationError(code, message);
  }
  if (httpStatus >= 500) {
    throw new InternalServerError(code, message);
  }
  throw new BadRequestError(code, message);
}

export function throwOtpRequestFailure(result: OtpRequestResult): never {
  if (result.failureCode != null && result.httpStatus != null) {
    throwFromOtpFailure({
      code: result.failureCode,
      httpStatus: result.httpStatus,
      message: result.failureMessage ?? 'OTP request failed',
    });
  }
  throw new TooManyRequestsError('OTP_RATE_LIMITED', 'Too many OTP requests');
}

export function throwOtpVerifyFailure(result: OtpVerifyResult): never {
  if (result.failureCode != null && result.httpStatus != null) {
    throwFromOtpFailure({
      code: result.failureCode,
      httpStatus: result.httpStatus,
      message: result.failureMessage ?? 'Invalid or expired OTP',
    });
  }
  throw new BadRequestError('OTP_INVALID', 'Invalid or expired OTP');
}
