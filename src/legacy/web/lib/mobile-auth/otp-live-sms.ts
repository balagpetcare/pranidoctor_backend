import { createHttpPlaceholderSmsProvider } from "../sms/providers/http-placeholder.js";

/**
 * Live OTP SMS entry point. Uses {@link createHttpPlaceholderSmsProvider} — a generic
 * JSON POST adapter; swap for a vendor-specific implementation when you pick an SMS partner.
 * See `docs/MOBILE_OTP_ENV.md` for required environment variables.
 */

function maskPhoneForLog(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return "****";
  return `${d.slice(0, 3)}****${d.slice(-2)}`;
}

function buildOtpBody(code: string): string {
  const template =
    process.env.SMS_OTP_TEMPLATE_BN?.trim() ||
    process.env.SMS_OTP_TEMPLATE?.trim();
  if (template && template.includes("{{code}}")) {
    return template.replace(/\{\{code\}\}/g, code);
  }
  return `প্রাণী ডাক্তার যাচাইকরণ কোড: ${code}`;
}

export type LiveOtpSmsFailureReason =
  | "MISSING_CREDENTIALS"
  | "SEND_REJECTED";

/**
 * Sends OTP SMS in live mode. Reads credentials from env only (no hardcoded keys).
 * Never logs the OTP in plain text.
 */
export async function sendLiveOtpSms(
  phone: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: LiveOtpSmsFailureReason }> {
  const baseUrl =
    process.env.SMS_BASE_URL?.trim() || process.env.SMS_HTTP_URL?.trim();
  const apiKey =
    process.env.SMS_API_KEY?.trim() || process.env.SMS_HTTP_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    console.error(
      "[mobile-otp][live] SMS not configured: set SMS_BASE_URL (or SMS_HTTP_URL) and SMS_API_KEY (or SMS_HTTP_API_KEY)",
    );
    return { ok: false, reason: "MISSING_CREDENTIALS" };
  }

  const provider = createHttpPlaceholderSmsProvider({
    url: baseUrl,
    apiKey,
  });

  const result = await provider.sendSms({
    to: phone.trim(),
    body: buildOtpBody(code),
    referenceId: "otp",
  });

  if (!result.ok) {
    console.error(
      "[mobile-otp][live] SMS gateway rejected or failed",
      result.reason ?? "unknown",
      "to=",
      maskPhoneForLog(phone),
    );
    return { ok: false, reason: "SEND_REJECTED" };
  }

  console.info(
    "[mobile-otp][live] OTP SMS dispatched to=%s (code not logged)",
    maskPhoneForLog(phone),
  );
  return { ok: true };
}
