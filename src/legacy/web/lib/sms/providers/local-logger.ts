import type { SmsProvider, SmsSendInput, SmsSendResult } from "@/lib/sms/types";

function redactDigitsForLog(body: string): string {
  return body.replace(/\b\d{4,8}\b/g, "[digits]");
}

/**
 * Development SMS sink: logs to stderr (visible in `next dev`), never sends network traffic.
 */
export function createLocalLoggerSmsProvider(): SmsProvider {
  return {
    async sendSms(input: SmsSendInput): Promise<SmsSendResult> {
      const safeBody = redactDigitsForLog(input.body);
      console.error(
        `[sms][local] to=${input.to} ref=${input.referenceId ?? "-"} body=${safeBody}`,
      );
      return { ok: true, providerMessageId: "local-logged" };
    },
  };
}
