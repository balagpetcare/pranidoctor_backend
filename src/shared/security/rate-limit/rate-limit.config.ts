export interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration?: number;
  keyPrefix: string;
}

export const RateLimitPresets = {
  GLOBAL: {
    points: 1000,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:global:',
  },

  API_STANDARD: {
    points: 100,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:api:',
  },

  API_STRICT: {
    points: 30,
    duration: 60,
    blockDuration: 120,
    keyPrefix: 'rl:api:strict:',
  },

  AUTH_OTP_REQUEST: {
    points: 5,
    duration: 3600,
    blockDuration: 3600,
    keyPrefix: 'rl:otp:req:',
  },

  AUTH_OTP_VERIFY: {
    points: 5,
    duration: 300,
    blockDuration: 300,
    keyPrefix: 'rl:otp:verify:',
  },

  AUTH_LOGIN: {
    points: 10,
    duration: 900,
    blockDuration: 900,
    keyPrefix: 'rl:login:',
  },

  AUTH_REFRESH: {
    points: 30,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:refresh:',
  },

  AI_CHAT: {
    points: 20,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:ai:chat:',
  },

  AI_CHAT_DAILY: {
    points: 100,
    duration: 86400,
    blockDuration: 3600,
    keyPrefix: 'rl:ai:daily:',
  },

  UPLOAD: {
    points: 10,
    duration: 60,
    blockDuration: 120,
    keyPrefix: 'rl:upload:',
  },

  NOTIFICATION_SEND: {
    points: 50,
    duration: 60,
    blockDuration: 60,
    keyPrefix: 'rl:notify:',
  },

  SEARCH: {
    points: 30,
    duration: 60,
    blockDuration: 30,
    keyPrefix: 'rl:search:',
  },

  EXPORT: {
    points: 5,
    duration: 3600,
    blockDuration: 3600,
    keyPrefix: 'rl:export:',
  },
} as const;

export type RateLimitPresetName = keyof typeof RateLimitPresets;
