/**
 * Mobile OTP auth — ported from legacy otp-service (bcrypt challenges, frozen codes).
 */
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'node:crypto';

import { AuthAuditAction, UserRole, UserStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { authRequestContext, recordAuthAuditFireAndForget } from '../auth-audit.service.js';
import { AUTH_CHANNELS, normalizeBdMobilePhone } from '../identity-core.js';
import { dispatchMobileOtpDelivery } from '../../../legacy/web/lib/mobile-auth/otp-dispatch.js';
import { getOtpConfig, warnIfProdDevOtpMode } from '../../../legacy/web/lib/mobile-auth/otp-env.js';
import {
  OTP_MSG,
  otpHourlyRateLimitMessage,
  otpResendCooldownMessage,
} from '../../../legacy/web/lib/mobile-auth/otp-messages.js';

export type OtpServiceFailure = {
  ok: false;
  httpStatus: number;
  code: string;
  message: string;
};

export type OtpRequestSuccess = { ok: true };

export type OtpVerifySuccess = { ok: true; userId: string; isNewUser: boolean };

class RateLimitHourlyError extends Error {
  override name = 'RateLimitHourlyError';
}

class OtpCooldownError extends Error {
  constructor(readonly secondsRemaining: number) {
    super('OTP_COOLDOWN');
    this.name = 'OtpCooldownError';
  }
}

function generateNumericOtp(length: number): string {
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}

export class MobileOtpAuthService {
  async request(rawPhone: string, request?: Request): Promise<OtpRequestSuccess | OtpServiceFailure> {
    const ctx = authRequestContext(request);
    warnIfProdDevOtpMode();
    const cfg = getOtpConfig();
    const normalizedPhone = normalizeBdMobilePhone(rawPhone);
    if (!normalizedPhone) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_REQUEST,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { ok: false, code: 'VALIDATION_ERROR' },
      });
      return {
        ok: false,
        httpStatus: 422,
        code: 'VALIDATION_ERROR',
        message: OTP_MSG.validationPhone,
      };
    }

    const prisma = getPrisma();
    let plainCode: string;

    try {
      plainCode = await prisma.$transaction(async (tx) => {
        const row = await tx.mobileOtpChallenge.findUnique({
          where: { normalizedPhone },
        });

        const now = new Date();

        if (
          row?.lastOtpSentAt &&
          cfg.resendCooldownSeconds > 0 &&
          now.getTime() - row.lastOtpSentAt.getTime() < cfg.resendCooldownSeconds * 1000
        ) {
          const elapsed = Math.floor((now.getTime() - row.lastOtpSentAt.getTime()) / 1000);
          const remaining = Math.max(0, cfg.resendCooldownSeconds - elapsed);
          throw new OtpCooldownError(remaining);
        }

        let windowStart = row?.sendWindowStartedAt ?? null;
        let sendsInWindow = row?.sendsInWindow ?? 0;

        if (!windowStart || now.getTime() - windowStart.getTime() > cfg.sendWindowMs) {
          windowStart = now;
          sendsInWindow = 0;
        }

        if (sendsInWindow >= cfg.maxSendsPerHour) {
          throw new RateLimitHourlyError();
        }

        const code = generateNumericOtp(cfg.length);
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(now.getTime() + cfg.ttlSeconds * 1000);

        await tx.mobileOtpChallenge.upsert({
          where: { normalizedPhone },
          create: {
            normalizedPhone,
            codeHash,
            expiresAt,
            verifyAttempts: 0,
            sendWindowStartedAt: windowStart,
            sendsInWindow: sendsInWindow + 1,
            lastOtpSentAt: now,
          },
          update: {
            codeHash,
            expiresAt,
            verifyAttempts: 0,
            sendWindowStartedAt: windowStart,
            sendsInWindow: sendsInWindow + 1,
            lastOtpSentAt: now,
          },
        });

        return code;
      });
    } catch (e) {
      if (e instanceof OtpCooldownError) {
        recordAuthAuditFireAndForget({
          action: AuthAuditAction.OTP_REQUEST,
          channel: AUTH_CHANNELS.mobile,
          ...ctx,
          metadata: { ok: false, code: 'RESEND_COOLDOWN' },
        });
        return {
          ok: false,
          httpStatus: 429,
          code: 'RESEND_COOLDOWN',
          message: otpResendCooldownMessage(e.secondsRemaining),
        };
      }
      if (e instanceof RateLimitHourlyError) {
        recordAuthAuditFireAndForget({
          action: AuthAuditAction.OTP_REQUEST,
          channel: AUTH_CHANNELS.mobile,
          ...ctx,
          metadata: { ok: false, code: 'RATE_LIMITED' },
        });
        return {
          ok: false,
          httpStatus: 429,
          code: 'RATE_LIMITED',
          message: otpHourlyRateLimitMessage(),
        };
      }
      console.error('[mobile-otp] request transaction failed', e);
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_REQUEST,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { ok: false, code: 'OTP_REQUEST_FAILED' },
      });
      return {
        ok: false,
        httpStatus: 500,
        code: 'OTP_REQUEST_FAILED',
        message: OTP_MSG.requestFailed,
      };
    }

    const expiresAt = new Date(Date.now() + cfg.ttlSeconds * 1000);
    const delivered = await dispatchMobileOtpDelivery({
      normalizedPhone,
      plainCode,
      ttlSeconds: cfg.ttlSeconds,
      expiresAt,
    });

    if (!delivered.ok) {
      try {
        await prisma.mobileOtpChallenge.deleteMany({
          where: { normalizedPhone },
        });
      } catch (delErr) {
        console.error('[mobile-otp] rollback challenge after SMS failure', delErr);
      }
      const missingGateway = delivered.reason === 'SMS_NOT_CONFIGURED';
      const code = missingGateway ? 'SMS_NOT_CONFIGURED' : 'SMS_UNAVAILABLE';
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_REQUEST,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { ok: false, code },
      });
      return {
        ok: false,
        httpStatus: 503,
        code,
        message: missingGateway ? OTP_MSG.smsNotConfigured : OTP_MSG.smsUnavailable,
      };
    }

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.OTP_REQUEST,
      channel: AUTH_CHANNELS.mobile,
      ...ctx,
      metadata: { ok: true },
    });

    return { ok: true };
  }

  async verify(
    rawPhone: string,
    rawCode: string,
    request?: Request,
  ): Promise<OtpVerifySuccess | OtpServiceFailure> {
    const ctx = authRequestContext(request);
    const cfg = getOtpConfig();
    const normalizedPhone = normalizeBdMobilePhone(rawPhone);
    const code = rawCode.replace(/\s/g, '');
    const codeOk = new RegExp(`^\\d{${cfg.length}}$`).test(code);

    if (!normalizedPhone || !codeOk) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: 'WRONG_OTP' },
      });
      return {
        ok: false,
        httpStatus: 401,
        code: 'WRONG_OTP',
        message: OTP_MSG.wrongCode,
      };
    }

    const prisma = getPrisma();
    const challenge = await prisma.mobileOtpChallenge.findUnique({
      where: { normalizedPhone },
    });

    if (!challenge) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: 'EXPIRED_OTP' },
      });
      return {
        ok: false,
        httpStatus: 401,
        code: 'EXPIRED_OTP',
        message: OTP_MSG.expired,
      };
    }

    const now = new Date();
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      await prisma.mobileOtpChallenge.deleteMany({ where: { normalizedPhone } });
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: 'EXPIRED_OTP' },
      });
      return {
        ok: false,
        httpStatus: 401,
        code: 'EXPIRED_OTP',
        message: OTP_MSG.expired,
      };
    }

    if (challenge.verifyAttempts >= cfg.maxAttempts) {
      await prisma.mobileOtpChallenge.deleteMany({ where: { normalizedPhone } });
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: 'TOO_MANY_ATTEMPTS' },
      });
      return {
        ok: false,
        httpStatus: 401,
        code: 'TOO_MANY_ATTEMPTS',
        message: OTP_MSG.tooManyAttempts,
      };
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      const nextAttempts = challenge.verifyAttempts + 1;
      if (nextAttempts >= cfg.maxAttempts) {
        await prisma.mobileOtpChallenge.deleteMany({ where: { normalizedPhone } });
        recordAuthAuditFireAndForget({
          action: AuthAuditAction.OTP_VERIFY_FAILURE,
          channel: AUTH_CHANNELS.mobile,
          ...ctx,
          metadata: { code: 'TOO_MANY_ATTEMPTS' },
        });
        return {
          ok: false,
          httpStatus: 401,
          code: 'TOO_MANY_ATTEMPTS',
          message: OTP_MSG.tooManyAttempts,
        };
      }
      await prisma.mobileOtpChallenge.update({
        where: { normalizedPhone },
        data: { verifyAttempts: { increment: 1 } },
      });
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: 'WRONG_OTP' },
      });
      return {
        ok: false,
        httpStatus: 401,
        code: 'WRONG_OTP',
        message: OTP_MSG.wrongCode,
      };
    }

    const userResult = await this.ensureCustomerUserForPhone(normalizedPhone);
    if (!userResult.ok) {
      recordAuthAuditFireAndForget({
        action: AuthAuditAction.OTP_VERIFY_FAILURE,
        channel: AUTH_CHANNELS.mobile,
        ...ctx,
        metadata: { code: userResult.code },
      });
      return userResult;
    }

    await prisma.mobileOtpChallenge.deleteMany({ where: { normalizedPhone } });

    recordAuthAuditFireAndForget({
      action: AuthAuditAction.OTP_VERIFY_SUCCESS,
      channel: AUTH_CHANNELS.mobile,
      userId: userResult.userId,
      role: UserRole.CUSTOMER,
      ...ctx,
    });

    return {
      ok: true,
      userId: userResult.userId,
      isNewUser: userResult.isNewUser,
    };
  }

  private async ensureCustomerUserForPhone(
    normalizedPhone: string,
  ): Promise<
    | { ok: true; userId: string; isNewUser: boolean }
    | OtpServiceFailure
  > {
    const prisma = getPrisma();
    const existing = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
      include: { customerProfile: true },
    });

    if (existing) {
      if (
        existing.role !== UserRole.CUSTOMER ||
        existing.status !== UserStatus.ACTIVE ||
        !existing.customerProfile
      ) {
        return {
          ok: false,
          httpStatus: 403,
          code: 'LOGIN_NOT_ALLOWED',
          message: OTP_MSG.loginNotAllowed,
        };
      }
      return { ok: true, userId: existing.id, isNewUser: false };
    }

    const email = `${normalizedPhone}@mobile-otp.pranidoctor.internal`;
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    try {
      const created = await prisma.user.create({
        data: {
          email,
          phone: normalizedPhone,
          passwordHash,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          customerProfile: {
            create: {
              displayName: `গ্রাহক ${normalizedPhone.slice(-4)}`,
            },
          },
        },
      });
      return { ok: true, userId: created.id, isNewUser: true };
    } catch (e) {
      console.error('[mobile-otp] customer bootstrap failed', e);
      return {
        ok: false,
        httpStatus: 500,
        code: 'SIGNUP_FAILED',
        message: OTP_MSG.signupFailed,
      };
    }
  }
}

/** Legacy-compatible exports for `@/lib/mobile-auth/otp-service`. */
export async function requestMobileCustomerOtp(
  rawPhone: string,
  request?: Request,
): Promise<OtpRequestSuccess | OtpServiceFailure> {
  return getMobileOtpAuthService().request(rawPhone, request);
}

export async function verifyMobileCustomerOtp(
  rawPhone: string,
  rawCode: string,
  request?: Request,
): Promise<OtpVerifySuccess | OtpServiceFailure> {
  return getMobileOtpAuthService().verify(rawPhone, rawCode, request);
}

let mobileOtpInstance: MobileOtpAuthService | null = null;

export function getMobileOtpAuthService(): MobileOtpAuthService {
  if (!mobileOtpInstance) {
    mobileOtpInstance = new MobileOtpAuthService();
  }
  return mobileOtpInstance;
}
