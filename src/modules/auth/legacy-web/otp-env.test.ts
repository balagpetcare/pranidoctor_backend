import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("otp-env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to dev when OTP_MODE unset", async () => {
    const { getOtpMode } = await import("./otp-env");
    expect(getOtpMode()).toBe("dev");
  });

  it("uses live only when OTP_MODE=live", async () => {
    vi.stubEnv("OTP_MODE", "live");
    const { getOtpMode } = await import("./otp-env");
    expect(getOtpMode()).toBe("live");
  });

  it("treats unknown values as dev", async () => {
    vi.stubEnv("OTP_MODE", "staging");
    const { getOtpMode } = await import("./otp-env");
    expect(getOtpMode()).toBe("dev");
  });

  it("applies OTP_TTL_MINUTES to ttlSeconds", async () => {
    vi.stubEnv("OTP_MODE", "dev");
    vi.stubEnv("OTP_TTL_MINUTES", "10");
    vi.stubEnv("MOBILE_OTP_TTL_MINUTES", "");
    const { getOtpConfig } = await import("./otp-env");
    expect(getOtpConfig().ttlSeconds).toBe(600);
  });

  it("defaults ttl to 15 minutes when unset", async () => {
    vi.stubEnv("OTP_MODE", "dev");
    const { getOtpConfig } = await import("./otp-env");
    expect(getOtpConfig().ttlSeconds).toBe(900);
  });

  it("prefers MOBILE_OTP_TTL_MINUTES over OTP_TTL_MINUTES", async () => {
    vi.stubEnv("OTP_MODE", "dev");
    vi.stubEnv("OTP_TTL_MINUTES", "10");
    vi.stubEnv("MOBILE_OTP_TTL_MINUTES", "12");
    const { getOtpConfig } = await import("./otp-env");
    expect(getOtpConfig().ttlSeconds).toBe(12 * 60);
  });
});
