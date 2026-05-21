/** @deprecated Re-export only — use `services/mobile-otp-auth.service` (P1-10). */
export {
  requestMobileCustomerOtp,
  verifyMobileCustomerOtp,
  getMobileOtpAuthService,
  MobileOtpAuthService,
  type OtpRequestSuccess,
  type OtpServiceFailure,
  type OtpVerifySuccess,
} from '../services/mobile-otp-auth.service.js';
