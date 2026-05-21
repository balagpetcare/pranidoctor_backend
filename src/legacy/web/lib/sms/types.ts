export type SmsSendInput = {
  to: string;
  body: string;
  /** Optional idempotency / tracing key */
  referenceId?: string;
};

export type SmsSendResult = {
  ok: boolean;
  providerMessageId?: string;
  skipped?: boolean;
  reason?: string;
};

export interface SmsProvider {
  sendSms(input: SmsSendInput): Promise<SmsSendResult>;
}
