/**
 * P1-06 — OTP storage mode (Prisma default; Redis prepared for production).
 */
export type OtpStorageMode = 'prisma' | 'redis' | 'dual';

export function getOtpStorageMode(): OtpStorageMode {
  const raw = process.env.OTP_STORAGE?.trim().toLowerCase();
  if (raw === 'redis' || raw === 'dual') {
    return raw;
  }
  return 'prisma';
}

export function shouldUseRedisOtpStore(): boolean {
  if (getOtpStorageMode() === 'prisma') return false;
  const redisOn = process.env.REDIS_ENABLED?.trim().toLowerCase();
  return redisOn === 'true' || redisOn === '1';
}
