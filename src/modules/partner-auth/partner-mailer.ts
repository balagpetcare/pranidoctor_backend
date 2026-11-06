/**
 * Transactional e-mail for partner auth (password reset).
 *
 *   EMAIL_PROVIDER=brevo    → Brevo REST API (BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME)
 *   EMAIL_PROVIDER=console  → no network; message printed to the server terminal (dev only)
 *
 * Default: `console` outside production, `brevo` in production.
 */
export type MailResult = { ok: true } | { ok: false; reason: string };

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  /** Plain text echoed to the terminal in console mode. */
  text: string;
};

function provider(): 'brevo' | 'console' {
  const raw = process.env['EMAIL_PROVIDER']?.trim().toLowerCase();
  if (raw === 'brevo' || raw === 'console') return raw;
  return process.env['NODE_ENV'] === 'production' ? 'brevo' : 'console';
}

export async function sendPartnerMail(message: MailMessage): Promise<MailResult> {
  if (provider() === 'console') {
    console.info(`[partner-mail:DEV] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return { ok: true };
  }

  const apiKey = process.env['BREVO_API_KEY']?.trim();
  const fromEmail = process.env['MAIL_FROM']?.trim();
  const fromName = process.env['MAIL_FROM_NAME']?.trim() || 'Prani Doctor';
  if (!apiKey || !fromEmail) {
    console.error('[partner-mail] BREVO_API_KEY or MAIL_FROM missing');
    return { ok: false, reason: 'MAIL_NOT_CONFIGURED' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
      }),
    });
    if (!res.ok) {
      console.error(`[partner-mail] Brevo rejected the request (HTTP ${res.status})`);
      return { ok: false, reason: `BREVO_HTTP_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'MAIL_FETCH_FAILED' };
  }
}

export function passwordResetMail(to: string, code: string, ttlMinutes: number): MailMessage {
  const text = `প্রাণী ডাক্তার পার্টনার: আপনার পাসওয়ার্ড রিসেট কোড ${code}। কোডটি ${ttlMinutes} মিনিট পর্যন্ত কার্যকর। আপনি অনুরোধ না করলে এটি উপেক্ষা করুন।`;
  const html =
    `<p>প্রাণী ডাক্তার পার্টনার</p>` +
    `<p>আপনার পাসওয়ার্ড রিসেট কোড: <strong style="font-size:20px">${code}</strong></p>` +
    `<p>কোডটি ${ttlMinutes} মিনিট পর্যন্ত কার্যকর। আপনি অনুরোধ না করলে এটি উপেক্ষা করুন।</p>`;
  return { to, subject: 'পাসওয়ার্ড রিসেট কোড', html, text };
}
