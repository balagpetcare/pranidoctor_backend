import type { SmsProvider, SmsSendInput, SmsSendResult } from "@/lib/sms/types";

export function createNoopSmsProvider(): SmsProvider {
  return {
    async sendSms(input: SmsSendInput): Promise<SmsSendResult> {
      void input;
      return { ok: true, skipped: true, reason: "NOOP" };
    },
  };
}
