/**
 * Transactional SMS for partner auth.
 *
 *   SMS_PROVIDER=bulksmsbd → BulkSMSBD (BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID)
 *   SMS_PROVIDER=console   → no network; message printed to the server terminal (dev only)
 *
 * Default: `console` outside production, `bulksmsbd` in production.
 * The BulkSMSBD endpoint and message type can be overridden with
 * BULKSMSBD_BASE_URL / BULKSMSBD_MESSAGE_TYPE — confirm against your account docs.
 */
export type SmsResult = { ok: true } | { ok: false; reason: string };

function provider(): 'bulksmsbd' | 'console' {
  const raw = process.env['SMS_PROVIDER']?.trim().toLowerCase();
  if (raw === 'bulksmsbd' || raw === 'console') return raw;
  return process.env['NODE_ENV'] === 'production' ? 'bulksmsbd' : 'console';
}

/** `01XXXXXXXXX` / `+8801XXXXXXXXX` → `8801XXXXXXXXX` (gateway format). */
export function toGatewayNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (/^8801\d{9}$/.test(digits)) return digits;
  if (/^01\d{9}$/.test(digits)) return `88${digits}`;
  return null;
}

export async function sendPartnerSms(phone: string, message: string): Promise<SmsResult> {
  const number = toGatewayNumber(phone);
  if (!number) return { ok: false, reason: 'INVALID_PHONE' };

  if (provider() === 'console') {
    console.info(`[partner-sms:DEV] to=${number} message="${message}"`);
    return { ok: true };
  }

  const apiKey = process.env['BULKSMSBD_API_KEY']?.trim();
  const senderId = process.env['BULKSMSBD_SENDER_ID']?.trim();
  if (!apiKey || !senderId) {
    console.error('[partner-sms] BULKSMSBD_API_KEY or BULKSMSBD_SENDER_ID missing');
    return { ok: false, reason: 'SMS_NOT_CONFIGURED' };
  }
  const baseUrl = process.env['BULKSMSBD_BASE_URL']?.trim() || 'http://bulksmsbd.net/api/smsapi';
  const type = process.env['BULKSMSBD_MESSAGE_TYPE']?.trim() || 'text';

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: apiKey,
        type,
        number,
        senderid: senderId,
        message,
      }).toString(),
    });
    if (!res.ok) return { ok: false, reason: `BULKSMSBD_HTTP_${res.status}` };

    // BulkSMSBD answers with JSON like { response_code: 202, ... } on success.
    const data: unknown = await res.json().catch(() => null);
    const code =
      data && typeof data === 'object' && 'response_code' in data
        ? Number((data as { response_code: unknown }).response_code)
        : NaN;
    if (code !== 202) return { ok: false, reason: `BULKSMSBD_CODE_${Number.isNaN(code) ? 'UNKNOWN' : code}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'SMS_FETCH_FAILED' };
  }
}

/** ASCII-only to avoid gateway encoding surprises; Bangla text can be enabled once verified. */
export function passwordResetSmsText(code: string, ttlMinutes: number): string {
  return `Prani Doctor Partner: your password reset code is ${code}. Valid for ${ttlMinutes} min. Do not share it.`;
}
