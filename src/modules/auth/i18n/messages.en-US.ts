import type { AuthMessageKey } from './catalog.types.js';

export const MESSAGES_EN_US: Record<AuthMessageKey, string> = {
  INVALID_JSON: 'Request body must be JSON.',
  VALIDATION_ERROR: 'The submitted data is invalid.',
  SERVER_MISCONFIGURED: 'Server is misconfigured. Contact the site administrator.',
  DATABASE_ERROR: 'Database error. Please try again later.',
  NOT_FOUND: 'Resource not found.',
  OTP_VALIDATION_PHONE: 'Enter a valid Bangladesh mobile number.',
  OTP_RESEND_COOLDOWN: 'Please wait before requesting another code.',
  OTP_RATE_LIMITED: 'Too many codes sent to this number. Try again in one hour.',
  OTP_REQUEST_FAILED: 'Could not send verification code. Try again shortly.',
  OTP_SMS_UNAVAILABLE: 'SMS is unavailable. Try again shortly.',
  OTP_SMS_NOT_CONFIGURED: 'SMS gateway is not configured. Contact the administrator.',
  OTP_WRONG: 'Incorrect OTP. Please try again.',
  OTP_EXPIRED: 'Code has expired. Request a new code.',
  OTP_TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Try again later.',
  OTP_LOGIN_NOT_ALLOWED: 'Sign-in is not allowed for this number.',
  OTP_SIGNUP_FAILED: 'Could not complete sign-in. Please try again.',
  OTP_SERVER_MISCONFIGURED:
    'Mobile JWT secret is not configured. Contact the administrator.',
  OTP_TOKEN_ISSUE_FAILED: 'Could not issue access token. Check server configuration.',
  CRED_VALIDATION_NAME: 'Name is required.',
  CRED_VALIDATION_PHONE: 'Enter a valid mobile number.',
  CRED_VALIDATION_PASSWORD: 'Password must be at least 6 characters.',
  CRED_VALIDATION_EMAIL: 'Enter a valid email address.',
  CRED_DUPLICATE_PHONE: 'This mobile number is already registered.',
  CRED_DUPLICATE_EMAIL: 'This email is already registered.',
  CRED_WRONG_IDENTIFIER_OR_PASSWORD: 'Mobile/email or password is incorrect.',
  CRED_SIGNUP_FAILED: 'Registration could not be completed. Try again.',
  UNAUTHORIZED: 'Invalid or expired token.',
  UNAUTHORIZED_BEARER_REQUIRED: 'Authorization Bearer token is required.',
  TOKEN_INVALID: 'Invalid or expired refresh token.',
  FORBIDDEN: 'You do not have permission for this resource.',
  FORBIDDEN_CUSTOMER_REQUIRED: 'A customer account is required for this resource.',
  SESSION_REVOKED: 'Session was revoked. Please sign in again.',
  DEVICE_PAYLOAD_INVALID: 'Invalid device payload.',
  DEVICE_KEY_REQUIRED: 'deviceKey is required.',
  DEVICE_PLATFORM_INVALID: 'platform must be android, ios, or web.',
  DEVICE_ID_REQUIRED: 'Device id is required.',
  DEVICE_NOT_FOUND: 'Device not found or already revoked.',
  PERMISSION_DENIED: 'You do not have permission for this action.',
  FORBIDDEN_ADMIN_PANEL: 'Admin panel access is required.',
  FORBIDDEN_DOCTOR_PANEL: 'Doctor panel access is required.',
  FORBIDDEN_TECHNICIAN_PANEL: 'Technician panel access is required.',
  DB_UNAVAILABLE: 'Database is unavailable. Try again later.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_IN_USE: 'This email is already registered.',
  VALIDATION_ERROR_NO_FIELDS: 'No updatable fields provided.',
  VALIDATION_ERROR_INVALID_BODY: 'Invalid request body.',
  VALIDATION_ERROR_LOGIN_PAYLOAD: 'Invalid email or password payload.',
  REFRESH_NOT_ENABLED: 'Refresh is not enabled on this server.',
  TOKEN_ISSUE_FAILED: 'Could not issue session token.',
  AUTH_NOT_CONFIGURED: 'Authentication is not configured on this server.',
  CUSTOMER_PROFILE_MISSING: 'Customer profile missing.',
};

export function otpResendCooldownMessageEn(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return 'You can request a new verification code.';
  }
  return `Please wait ${secondsRemaining} seconds before requesting another code.`;
}

export function otpHourlyRateLimitMessageEn(): string {
  return 'Too many codes sent to this number. Try again in one hour.';
}
