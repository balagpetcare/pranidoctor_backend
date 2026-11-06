import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';

import { UserStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import { logoutAllForUser } from '../auth/mobile-auth-credentials.service.js';
import { normalizeBdMobilePhone } from '../auth/phone.js';
import { getMobileJwtSecret } from '../auth/tokens/mobile-jwt.js';

import { passwordResetMail, sendPartnerMail } from './partner-mailer.js';
import { passwordResetSmsText, sendPartnerSms } from './partner-sms.js';
import { getPasswordResetStore } from './password-reset.store.js';

export type ResetChannel = 'sms' | 'email';

const CODE_TTL_SECONDS = 10 * 60;
const COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
export const MIN_PASSWORD_LENGTH = 8;

const SYNTHETIC_EMAIL_SUFFIXES = [
  '@mobile-otp.pranidoctor.internal',
  '@mobile-register.pranidoctor.internal',
];

export type ResetFailure = {
  ok: false;
  httpStatus: number;
  code: string;
  message: string;
};

export const RESET_MSG = {
  unavailable: 'এই মুহূর্তে সেবাটি চালু নেই। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  tooSoon: 'কিছুক্ষণ পরে আবার কোড চাইতে পারবেন।',
  tooManySends: 'অনেকবার কোড চাওয়া হয়েছে। এক ঘণ্টা পরে আবার চেষ্টা করুন।',
  invalidCode: 'কোডটি ভুল বা মেয়াদ শেষ হয়ে গেছে।',
  tooManyAttempts: 'অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড চেয়ে নিন।',
  weakPassword: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে এবং অক্ষর ও সংখ্যা দুটোই থাকতে হবে।`,
} as const;

function fail(httpStatus: number, code: string, message: string): ResetFailure {
  return { ok: false, httpStatus, code, message };
}

function hashCode(userId: string, code: string): string | null {
  const secret = getMobileJwtSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && /[A-Za-zঀ-৿]/.test(password) && /\d/.test(password);
}

function isRealEmail(email: string): boolean {
  const e = email.toLowerCase();
  return !SYNTHETIC_EMAIL_SUFFIXES.some((s) => e.endsWith(s));
}

async function findActiveUser(identifier: string) {
  const id = identifier.trim();
  if (!id) return null;
  const prisma = getPrisma();
  const user = id.includes('@')
    ? await prisma.user.findFirst({ where: { email: id.toLowerCase() } })
    : await (async () => {
        const phone = normalizeBdMobilePhone(id);
        return phone ? prisma.user.findFirst({ where: { phone } }) : null;
      })();
  return user && user.status === UserStatus.ACTIVE ? user : null;
}

/**
 * Sends a reset code. Always reports success for unknown accounts or unavailable channels
 * (no account enumeration) — only throttling and server-side problems are surfaced.
 */
export async function requestPasswordReset(params: {
  identifier: string;
  channel: ResetChannel;
}): Promise<{ ok: true } | ResetFailure> {
  const store = getPasswordResetStore();
  if (!store || !getMobileJwtSecret()) {
    return fail(503, 'RESET_UNAVAILABLE', RESET_MSG.unavailable);
  }

  const user = await findActiveUser(params.identifier);
  if (!user) return { ok: true };

  const wantsSms = params.channel === 'sms';
  const target = wantsSms ? user.phone : isRealEmail(user.email) ? user.email : null;
  if (!target) return { ok: true };

  if (await store.tryStartCooldown(user.id, COOLDOWN_SECONDS)) {
    return fail(429, 'RESET_TOO_SOON', RESET_MSG.tooSoon);
  }
  if ((await store.countSend(user.id, 60 * 60)) > MAX_SENDS_PER_HOUR) {
    return fail(429, 'RESET_TOO_MANY_SENDS', RESET_MSG.tooManySends);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const hash = hashCode(user.id, code);
  if (!hash) return fail(503, 'RESET_UNAVAILABLE', RESET_MSG.unavailable);
  await store.save(user.id, { hash }, CODE_TTL_SECONDS);

  const ttlMinutes = CODE_TTL_SECONDS / 60;
  const sent = wantsSms
    ? await sendPartnerSms(target, passwordResetSmsText(code, ttlMinutes))
    : await sendPartnerMail(passwordResetMail(target, code, ttlMinutes));
  if (!sent.ok) {
    await store.clear(user.id);
    console.error(`[password-reset] delivery failed via ${params.channel}: ${sent.reason}`);
    return fail(503, 'RESET_DELIVERY_FAILED', RESET_MSG.unavailable);
  }
  return { ok: true };
}

/** Verifies the code, sets the new password and signs the user out everywhere. */
export async function confirmPasswordReset(params: {
  identifier: string;
  code: string;
  newPassword: string;
}): Promise<{ ok: true } | ResetFailure> {
  if (!isStrongEnoughPassword(params.newPassword)) {
    return fail(422, 'WEAK_PASSWORD', RESET_MSG.weakPassword);
  }
  const store = getPasswordResetStore();
  if (!store) return fail(503, 'RESET_UNAVAILABLE', RESET_MSG.unavailable);

  const user = await findActiveUser(params.identifier);
  const record = user ? await store.load(user.id) : null;
  if (!user || !record) return fail(400, 'INVALID_RESET_CODE', RESET_MSG.invalidCode);

  if ((await store.addAttempt(user.id, CODE_TTL_SECONDS)) > MAX_ATTEMPTS) {
    await store.clear(user.id);
    return fail(429, 'RESET_TOO_MANY_ATTEMPTS', RESET_MSG.tooManyAttempts);
  }

  const expected = hashCode(user.id, params.code.trim());
  if (!expected || !safeEqualHex(expected, record.hash)) {
    return fail(400, 'INVALID_RESET_CODE', RESET_MSG.invalidCode);
  }

  const passwordHash = await bcrypt.hash(params.newPassword, 10);
  await getPrisma().user.update({ where: { id: user.id }, data: { passwordHash } });
  await store.clear(user.id);
  await logoutAllForUser(user.id);
  return { ok: true };
}
