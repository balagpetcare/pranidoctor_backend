/**
 * Re-export canonical OTP implementation (P1-03).
 */
export {
  requestMobileCustomerOtp,
  verifyMobileCustomerOtp,
  type OtpRequestSuccess,
  type OtpServiceFailure,
  type OtpVerifySuccess,
} from '../../../../modules/auth/services/mobile-otp-auth.service.js';
