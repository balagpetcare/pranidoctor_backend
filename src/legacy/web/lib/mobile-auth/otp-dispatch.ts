import { recordOtpDevSend } from "./otp-dev-log.js";
import { getOtpMode } from "./otp-env.js";
import { sendLiveOtpSms } from "./otp-live-sms.js";

/**
 * After persisting a hashed OTP, deliver via dev log or live SMS.
 * Dev: prints OTP to terminal (and optional in-memory dev log for admin).
 * Live: SMS only; no plain OTP in server logs.
 */
export async function dispatchMobileOtpDelivery(params: {
  normalizedPhone: string;
  plainCode: string;
  ttlSeconds: number;
  expiresAt: Date;
}): Promise<
  | { ok: true }
  | { ok: false; reason: "LIVE_SMS_FAILED" | "SMS_NOT_CONFIGURED" }
> {
  const mode = getOtpMode();
  const ttlMin = Math.max(1, Math.ceil(params.ttlSeconds / 60));

  if (mode === "dev") {
    console.info(
      `[PraniDoctor OTP DEV] phone=${params.normalizedPhone} otp=${params.plainCode} expiresIn=${ttlMin}m`,
    );
    recordOtpDevSend({
      phoneNormalized: params.normalizedPhone,
      plainCode: params.plainCode,
      expiresAt: params.expiresAt,
    });
    return { ok: true };
  }

  const sent = await sendLiveOtpSms(params.normalizedPhone, params.plainCode);
  if (!sent.ok) {
    if (sent.reason === "MISSING_CREDENTIALS") {
      return { ok: false, reason: "SMS_NOT_CONFIGURED" };
    }
    return { ok: false, reason: "LIVE_SMS_FAILED" };
  }
  return { ok: true };
}
