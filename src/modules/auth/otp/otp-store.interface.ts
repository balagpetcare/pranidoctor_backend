import type { OtpChallenge } from '../auth.types.js';

/**
 * Ephemeral OTP challenge store — Prisma (`MobileOtpChallenge`) or Redis (P1-06 prep).
 */
export interface OtpStore {
  createChallenge(phone: string, codeHash: string, expiresAt: Date): Promise<OtpChallenge>;
  findChallenge(phone: string): Promise<OtpChallenge | null>;
  incrementAttempts(id: string, phone: string): Promise<void>;
  markVerified(id: string, phone: string): Promise<void>;
  deleteChallenge(phone: string): Promise<void>;
  countRecentSends(phone: string, since: Date): Promise<number>;
}
