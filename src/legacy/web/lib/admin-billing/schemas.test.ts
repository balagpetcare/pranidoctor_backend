import { describe, expect, it } from "vitest";

import {
  adminBillingListQuerySchema,
  adminBillingSettingsPutSchema,
} from "@/lib/admin-billing/schemas";

describe("adminBillingSettingsPutSchema", () => {
  it("accepts 0–100 percent", () => {
    const r = adminBillingSettingsPutSchema.safeParse({ commissionPercent: 10 });
    expect(r.success).toBe(true);
  });

  it("rejects over 100", () => {
    const r = adminBillingSettingsPutSchema.safeParse({ commissionPercent: 101 });
    expect(r.success).toBe(false);
  });
});

describe("adminBillingListQuerySchema", () => {
  it("parses ISO dates", () => {
    const r = adminBillingListQuerySchema.safeParse({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(r.success).toBe(true);
  });

  it("defaults limit to 25 (aligned with admin billing list UI)", () => {
    const r = adminBillingListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(25);
  });
});
