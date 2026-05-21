import { shouldExposePlainOtpInDebugPanel } from "./otp-env.js";

export type OtpDevLogEntry = {
  id: string;
  createdAtIso: string;
  /** E.164-style local digits */
  phoneNormalized: string;
  phoneMasked: string;
  /** Only populated in non-production dev OTP; never returned for production builds. */
  otpPlain: string | null;
  expiresAtIso: string;
  status: "sent";
};

const MAX = 100;
const entries: OtpDevLogEntry[] = [];

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return "****";
  return `${d.slice(0, 3)}****${d.slice(-2)}`;
}

export function recordOtpDevSend(params: {
  phoneNormalized: string;
  plainCode: string;
  expiresAt: Date;
}): void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  entries.unshift({
    id,
    createdAtIso: new Date().toISOString(),
    phoneNormalized: params.phoneNormalized,
    phoneMasked: maskPhone(params.phoneNormalized),
    otpPlain: params.plainCode,
    expiresAtIso: params.expiresAt.toISOString(),
    status: "sent",
  });
  while (entries.length > MAX) entries.pop();
}

export type OtpDevLogAdminRow = {
  id: string;
  createdAtIso: string;
  phoneNormalized: string;
  phoneMasked: string;
  otpPlain: string | null;
  expiresAtIso: string;
  status: OtpDevLogEntry["status"];
};

/**
 * Snapshot for admin API: strips plain OTP unless safe dev environment.
 */
export function getOtpDevLogSnapshotForAdmin(): OtpDevLogAdminRow[] {
  const expose = shouldExposePlainOtpInDebugPanel();
  return entries.map((e) => ({
    ...e,
    otpPlain: expose ? e.otpPlain : null,
    phoneNormalized: expose ? e.phoneNormalized : maskPhone(e.phoneNormalized),
  }));
}
