export const CacheKeys = {
  user: (id: string): string => `user:${id}`,
  userByPhone: (phone: string): string => `user:phone:${phone}`,
  userProfile: (userId: string): string => `user:${userId}:profile`,

  doctor: (id: string): string => `doctor:${id}`,
  doctorByUserId: (userId: string): string => `doctor:user:${userId}`,
  doctorSchedule: (doctorId: string): string => `doctor:${doctorId}:schedule`,
  doctorsList: (filter: string): string => `doctors:list:${filter}`,

  clinic: (id: string): string => `clinic:${id}`,
  clinicBySlug: (slug: string): string => `clinic:slug:${slug}`,
  clinicServices: (clinicId: string): string => `clinic:${clinicId}:services`,

  animal: (id: string): string => `animal:${id}`,
  animalsByOwner: (ownerId: string): string => `animals:owner:${ownerId}`,

  lead: (id: string): string => `lead:${id}`,

  conversation: (id: string): string => `ai:conversation:${id}`,
  conversationContext: (conversationId: string): string => `ai:context:${conversationId}`,
  sessionSummary: (sessionId: string): string => `ai:summary:${sessionId}`,
  promptCache: (hash: string): string => `ai:prompt:${hash}`,

  otpChallenge: (phone: string): string => `otp:challenge:${phone}`,
  otpAttempts: (phone: string): string => `otp:attempts:${phone}`,
  otpRateLimit: (phone: string): string => `otp:rate:${phone}`,

  rateLimit: (key: string): string => `rate:${key}`,

  session: (sessionId: string): string => `session:${sessionId}`,
  refreshToken: (userId: string): string => `refresh:${userId}`,
} as const;

export const CacheTTL = {
  SHORT: 60,
  MEDIUM: 300,
  STANDARD: 3600,
  LONG: 86400,
  WEEK: 604800,

  USER: 3600,
  DOCTOR: 3600,
  CLINIC: 3600,
  ANIMAL: 1800,
  LEAD: 600,

  OTP_CHALLENGE: 300,
  OTP_RATE_LIMIT: 3600,

  CONVERSATION_CONTEXT: 1800,
  SESSION_SUMMARY: 86400,
  PROMPT_CACHE: 3600,

  SESSION: 86400,
  REFRESH_TOKEN: 604800,
} as const;
