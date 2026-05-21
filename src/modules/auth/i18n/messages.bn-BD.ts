import type { AuthMessageKey } from './catalog.types.js';

/** Frozen Bengali OTP strings (byte-stable for compat OTP routes). */
export const OTP_MSG = {
  serverMisconfigured:
    'মোবাইল প্রবেশের জন্য সার্ভারে JWT সিক্রেট সেট করা নেই। সাইট প্রশাসককে জানান।',
  validationPhone: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন।',
  requestFailed: 'যাচাইকরণ কোড পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  smsUnavailable: 'এসএমএস পাঠানো যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।',
  smsNotConfigured: 'এসএমএস গেটওয়ে কনফিগার করা নেই। সাইট প্রশাসককে জানান।',
  tokenIssueFailed: 'অ্যাক্সেস টোকেন তৈরি করা যায়নি। সার্ভার কনফিগারেশন পরীক্ষা করুন।',
  wrongCode: 'OTP কোডটি সঠিক নয়। আবার চেষ্টা করুন।',
  expired: 'কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোড নিন।',
  tooManyAttempts: 'অনেকবার ভুল OTP দেওয়া হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  loginNotAllowed: 'এই নম্বর দিয়ে প্রবেশ করা যাচ্ছে না।',
  signupFailed: 'প্রবেশ সম্পূর্ণ করা যায়নি। আবার চেষ্টা করুন।',
} as const;

export function otpResendCooldownMessageBn(secondsRemaining: number): string {
  if (secondsRemaining <= 0) {
    return 'আবার যাচাইকরণ কোড পাঠাতে পারেন।';
  }
  return `অনুরোধ খুব দ্রুত। ${secondsRemaining} সেকেন্ড পর আবার চেষ্টা করুন।`;
}

export function otpHourlyRateLimitMessageBn(): string {
  return 'এই নম্বরে অনেকবার কোড পাঠানো হয়েছে। এক ঘণ্টা পর আবার চেষ্টা করুন।';
}

/** Frozen Bengali credential strings. */
export const CRED_MSG = {
  validationName: 'নাম লিখুন।',
  validationPhone: 'সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।',
  validationPassword: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
  validationEmail: 'সঠিক ইমেইল ফরম্যাট লিখুন।',
  duplicatePhone: 'এই মোবাইল নম্বর দিয়ে আগে অ্যাকাউন্ট তৈরি হয়েছে।',
  duplicateEmail: 'এই ইমেইল দিয়ে আগে অ্যাকাউন্ট তৈরি হয়েছে।',
  wrongIdentifierOrPassword: 'মোবাইল/ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।',
  signupFailed: 'অ্যাকাউন্ট তৈরি করা যায়নি।',
  loginNotAllowed: 'এই অ্যাকাউন্ট দিয়ে প্রবেশ করা যাবে না।',
  serverError: 'সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
} as const;

export const MESSAGES_BN_BD: Record<AuthMessageKey, string> = {
  INVALID_JSON: 'অনুরোধের তথ্য সঠিক নয়। JSON পাঠান।',
  VALIDATION_ERROR: 'দেওয়া তথ্য সঠিক নয়।',
  SERVER_MISCONFIGURED: 'সার্ভার সঠিকভাবে কনফিগার করা নেই। সাইট প্রশাসককে জানান।',
  DATABASE_ERROR: 'ডাটাবেস ত্রুটি। পরে আবার চেষ্টা করুন।',
  NOT_FOUND: 'তথ্য পাওয়া যায়নি।',
  OTP_VALIDATION_PHONE: OTP_MSG.validationPhone,
  OTP_RESEND_COOLDOWN: 'অনুরোধ খুব দ্রুত। পরে আবার চেষ্টা করুন।',
  OTP_RATE_LIMITED: otpHourlyRateLimitMessageBn(),
  OTP_REQUEST_FAILED: OTP_MSG.requestFailed,
  OTP_SMS_UNAVAILABLE: OTP_MSG.smsUnavailable,
  OTP_SMS_NOT_CONFIGURED: OTP_MSG.smsNotConfigured,
  OTP_WRONG: OTP_MSG.wrongCode,
  OTP_EXPIRED: OTP_MSG.expired,
  OTP_TOO_MANY_ATTEMPTS: OTP_MSG.tooManyAttempts,
  OTP_LOGIN_NOT_ALLOWED: OTP_MSG.loginNotAllowed,
  OTP_SIGNUP_FAILED: OTP_MSG.signupFailed,
  OTP_SERVER_MISCONFIGURED: OTP_MSG.serverMisconfigured,
  OTP_TOKEN_ISSUE_FAILED: OTP_MSG.tokenIssueFailed,
  CRED_VALIDATION_NAME: CRED_MSG.validationName,
  CRED_VALIDATION_PHONE: CRED_MSG.validationPhone,
  CRED_VALIDATION_PASSWORD: CRED_MSG.validationPassword,
  CRED_VALIDATION_EMAIL: CRED_MSG.validationEmail,
  CRED_DUPLICATE_PHONE: CRED_MSG.duplicatePhone,
  CRED_DUPLICATE_EMAIL: CRED_MSG.duplicateEmail,
  CRED_WRONG_IDENTIFIER_OR_PASSWORD: CRED_MSG.wrongIdentifierOrPassword,
  CRED_SIGNUP_FAILED: CRED_MSG.signupFailed,
  UNAUTHORIZED: 'টোকেন সঠিক নয় বা মেয়াদ শেষ।',
  UNAUTHORIZED_BEARER_REQUIRED: 'প্রবেশের জন্য Bearer টোকেন প্রয়োজন।',
  TOKEN_INVALID: 'রিফ্রেশ টোকেন সঠিক নয় বা মেয়াদ শেষ।',
  FORBIDDEN: 'এই সেবার জন্য অনুমতি নেই।',
  FORBIDDEN_CUSTOMER_REQUIRED: 'এই সেবার জন্য গ্রাহক অ্যাকাউন্ট প্রয়োজন।',
  SESSION_REVOKED: 'সেশন বাতিল করা হয়েছে। আবার প্রবেশ করুন।',
  DEVICE_PAYLOAD_INVALID: 'ডিভাইস তথ্য সঠিক নয়।',
  DEVICE_KEY_REQUIRED: 'deviceKey প্রয়োজন।',
  DEVICE_PLATFORM_INVALID: 'platform অবশ্যই android, ios, বা web হতে হবে।',
  DEVICE_ID_REQUIRED: 'ডিভাইস আইডি প্রয়োজন।',
  DEVICE_NOT_FOUND: 'ডিভাইস পাওয়া যায়নি বা ইতিমধ্যে বাতিল।',
  PERMISSION_DENIED: 'এই কাজের জন্য অনুমতি নেই।',
  FORBIDDEN_ADMIN_PANEL: 'অ্যাডমিন প্যানেলে প্রবেশের অনুমতি নেই।',
  FORBIDDEN_DOCTOR_PANEL: 'ডাক্তার প্যানেলে প্রবেশের অনুমতি নেই।',
  FORBIDDEN_TECHNICIAN_PANEL: 'টেকনিশিয়ান প্যানেলে প্রবেশের অনুমতি নেই।',
  DB_UNAVAILABLE: 'ডাটাবেস সংযোগ উপলব্ধ নয়। পরে আবার চেষ্টা করুন।',
  INVALID_CREDENTIALS: 'ইমেইল/পাসওয়ার্ড সঠিক নয়।',
  EMAIL_IN_USE: 'এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে।',
  VALIDATION_ERROR_NO_FIELDS: 'আপডেট করার মতো কোনো তথ্য দেওয়া হয়নি।',
  VALIDATION_ERROR_INVALID_BODY: 'দেওয়া তথ্য সঠিক নয়।',
  VALIDATION_ERROR_LOGIN_PAYLOAD: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
  REFRESH_NOT_ENABLED: 'এই সার্ভারে রিফ্রেশ সক্রিয় নয়।',
  TOKEN_ISSUE_FAILED: 'সেশন টোকেন তৈরি করা যায়নি।',
  AUTH_NOT_CONFIGURED: 'সার্ভারে প্রবেশ কনফিগার করা নেই।',
  CUSTOMER_PROFILE_MISSING: 'গ্রাহক প্রোফাইল পাওয়া যায়নি।',
};
