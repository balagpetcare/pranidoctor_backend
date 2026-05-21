import { createHttpPlaceholderSmsProvider } from "@/lib/sms/providers/http-placeholder";
import { createLocalLoggerSmsProvider } from "@/lib/sms/providers/local-logger";
import { createNoopSmsProvider } from "@/lib/sms/providers/noop";
import type { SmsProvider } from "@/lib/sms/types";

/** Safe for admin UI: no URLs, API keys, or message bodies. */
export type SmsAdminStatusSnapshot = {
  /** Provider name after the same `http` → `local` redirect as runtime. */
  configuredProvider: string;
  /** Provider actually used (`unknown` values fall back to noop at runtime). */
  effectiveProvider: "local" | "noop" | "http";
  httpIgnoredInNonProduction: boolean;
  /** Whether `SMS_HTTP_URL` and `SMS_HTTP_API_KEY` are both non-empty (values not exposed). */
  httpCredentialsConfigured: boolean;
  /** True when `SMS_PROVIDER` resolves to a name other than local/noop/http (runtime uses noop). */
  unknownRawProvider: boolean;
  nodeEnv: string;
};

/**
 * Read-only snapshot for admin dashboards. Mirrors {@link defaultProviderName} / `switch`
 * in {@link createSmsService} without instantiating providers.
 */
export function getSmsAdminStatusSnapshot(): SmsAdminStatusSnapshot {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "";
  let httpIgnoredInNonProduction = false;
  let configured: string;
  if (explicit === "http" && process.env.NODE_ENV !== "production") {
    httpIgnoredInNonProduction = true;
    configured = "local";
  } else if (explicit) {
    configured = explicit;
  } else {
    configured = process.env.NODE_ENV === "production" ? "http" : "local";
  }

  const effective: "local" | "noop" | "http" =
    configured === "local" || configured === "noop" || configured === "http"
      ? configured
      : "noop";

  const url = process.env.SMS_HTTP_URL?.trim();
  const key = process.env.SMS_HTTP_API_KEY?.trim();

  return {
    configuredProvider: configured,
    effectiveProvider: effective,
    httpIgnoredInNonProduction,
    httpCredentialsConfigured: Boolean(url && key),
    unknownRawProvider: !["local", "noop", "http"].includes(configured),
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}

function defaultProviderName(): string {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase();
  /** Avoid accidental HTTP SMS in local/staging when developers set SMS_PROVIDER=http. */
  if (explicit === "http" && process.env.NODE_ENV !== "production") {
    console.warn(
      "[sms] SMS_PROVIDER=http is ignored when NODE_ENV is not production; using local logger",
    );
    return "local";
  }
  if (explicit) return explicit;
  return process.env.NODE_ENV === "production" ? "http" : "local";
}

export function createSmsService(): SmsProvider {
  const name = defaultProviderName();
  switch (name) {
    case "local":
      return createLocalLoggerSmsProvider();
    case "noop":
      return createNoopSmsProvider();
    case "http":
      return createHttpPlaceholderSmsProvider({
        url: process.env.SMS_HTTP_URL,
        apiKey: process.env.SMS_HTTP_API_KEY,
      });
    default: {
      console.warn(
        `[sms] Unknown SMS_PROVIDER="${name}", falling back to noop`,
      );
      return createNoopSmsProvider();
    }
  }
}

let singleton: SmsProvider | null = null;

export function getSmsService(): SmsProvider {
  if (!singleton) singleton = createSmsService();
  return singleton;
}
