import type { SmsProvider, SmsSendInput, SmsSendResult } from "../types.js";

/**
 * Generic REST placeholder — swap payload shape when a real vendor is chosen.
 * Missing URL or API key: no network call; returns ok=false with reason.
 */
export function createHttpPlaceholderSmsProvider(config: {
  url: string | undefined;
  apiKey: string | undefined;
}): SmsProvider {
  return {
    async sendSms(input: SmsSendInput): Promise<SmsSendResult> {
      const url = config.url?.trim();
      const apiKey = config.apiKey?.trim();
      if (!url || !apiKey) {
        console.warn(
          "[sms][http-placeholder] SMS_HTTP_URL or SMS_HTTP_API_KEY missing — skipping send",
        );
        return {
          ok: false,
          skipped: true,
          reason: "MISSING_SMS_CREDENTIALS",
        };
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            to: input.to,
            body: input.body,
            referenceId: input.referenceId,
          }),
        });

        if (!res.ok) {
          return {
            ok: false,
            reason: `HTTP_${res.status}`,
          };
        }

        let providerMessageId: string | undefined;
        try {
          const json: unknown = await res.json();
          if (
            json &&
            typeof json === "object" &&
            "id" in json &&
            typeof (json as { id: unknown }).id === "string"
          ) {
            providerMessageId = (json as { id: string }).id;
          }
        } catch {
          /* ignore non-JSON */
        }

        return {
          ok: true,
          ...(providerMessageId !== undefined ? { providerMessageId } : {}),
        };
      } catch {
        return { ok: false, reason: "FETCH_FAILED" };
      }
    },
  };
}
