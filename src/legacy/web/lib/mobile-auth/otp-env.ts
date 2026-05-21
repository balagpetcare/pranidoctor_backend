export type OtpMode = "dev" | "live";

export type OtpRuntimeConfig = {
  mode: OtpMode;
  ttlSeconds: number;
  length: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxSendsPerHour: number;
  sendWindowMs: number;
  debugPanelEnabled: boolean;
};

function parseIntEnv(
  key: string,
  def: number,
  min: number,
  max: number,
): number {
  const raw = process.env[key]?.trim();
  if (!raw) return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function parseBoolEnv(key: string, def: boolean): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return def;
}

/**
 * OTP lifetime for mobile customer login.
 * Prefer MOBILE_OTP_TTL_MINUTES; fallback OTP_TTL_MINUTES (legacy); default 15 minutes.
 */
export function getMobileOtpTtlMinutes(): number {
  const primary = process.env.MOBILE_OTP_TTL_MINUTES?.trim();
  if (primary !== undefined && primary !== "") {
    const n = Number.parseInt(primary, 10);
    if (Number.isFinite(n)) return Math.min(60, Math.max(1, n));
  }
  return parseIntEnv("OTP_TTL_MINUTES", 15, 1, 60);
}

/**
 * `live` only when OTP_MODE=live. Any other or missing value uses dev (no real SMS).
 */
export function getOtpMode(): OtpMode {
  const m = process.env.OTP_MODE?.trim().toLowerCase();
  return m === "live" ? "live" : "dev";
}

let warnedProdDevMode = false;

/** Call when handling an OTP send — avoids noise during Next.js static analysis. */
export function warnIfProdDevOtpMode(): void {
  if (
    warnedProdDevMode ||
    process.env.NODE_ENV !== "production" ||
    getOtpMode() !== "dev"
  ) {
    return;
  }
  warnedProdDevMode = true;
  console.warn(
    "[mobile-otp] WARNING: OTP_MODE=dev in production exposes OTP in logs — use OTP_MODE=live with SMS.",
  );
}

export function getOtpConfig(): OtpRuntimeConfig {
  const ttlMinutes = getMobileOtpTtlMinutes();
  const windowMinutes = parseIntEnv("OTP_SEND_WINDOW_MINUTES", 60, 5, 24 * 60);
  const mode = getOtpMode();
  return {
    mode,
    ttlSeconds: ttlMinutes * 60,
    length: parseIntEnv("OTP_LENGTH", 6, 4, 8),
    maxAttempts: parseIntEnv("OTP_MAX_ATTEMPTS", 5, 1, 20),
    resendCooldownSeconds: parseIntEnv(
      "OTP_RESEND_COOLDOWN_SECONDS",
      60,
      0,
      3600,
    ),
    maxSendsPerHour: parseIntEnv("OTP_MAX_SENDS_PER_HOUR", 5, 1, 50),
    sendWindowMs: windowMinutes * 60 * 1000,
    debugPanelEnabled: parseBoolEnv("OTP_DEBUG_PANEL_ENABLED", false),
  };
}

/**
 * Admin OTP debug UI/API: allowed when not production, or when explicitly enabled.
 */
export function isOtpDebugPanelAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return parseBoolEnv("OTP_DEBUG_PANEL_ENABLED", false);
}

/**
 * Never surface a plain OTP in the admin panel in production builds.
 */
export function shouldExposePlainOtpInDebugPanel(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return getOtpMode() === "dev";
}
