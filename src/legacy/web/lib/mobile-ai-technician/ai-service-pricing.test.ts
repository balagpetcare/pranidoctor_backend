import { describe, expect, it } from "vitest";

import {
  computeTotalCustomerPrice,
  formatPaisa,
  parseMoneyToPaisa,
  resolveServicePricing,
} from "./ai-service-pricing";

describe("money parsing", () => {
  it("parses whole and 2-decimal amounts into paisa", () => {
    expect(parseMoneyToPaisa(500)).toBe(50000n);
    expect(parseMoneyToPaisa("300")).toBe(30000n);
    expect(parseMoneyToPaisa("12.5")).toBe(1250n);
    expect(parseMoneyToPaisa("0.07")).toBe(7n);
  });

  it("rejects negatives, 3 decimals, text and blanks", () => {
    expect(parseMoneyToPaisa(-1)).toBeNull();
    expect(parseMoneyToPaisa("1.234")).toBeNull();
    expect(parseMoneyToPaisa("abc")).toBeNull();
    expect(parseMoneyToPaisa("")).toBeNull();
    expect(parseMoneyToPaisa(null)).toBeNull();
    expect(parseMoneyToPaisa(undefined)).toBeNull();
  });

  it("formats paisa with two decimals", () => {
    expect(formatPaisa(80000n)).toBe("800.00");
    expect(formatPaisa(5n)).toBe("0.05");
  });
});

describe("computeTotalCustomerPrice", () => {
  it("adds semen price and AI service charge (test example: 500 + 300 = 800)", () => {
    expect(computeTotalCustomerPrice(500, 300)).toBe("800.00");
    expect(computeTotalCustomerPrice("500", "300")).toBe("800.00");
  });

  it("is exact for fractional amounts (no float drift)", () => {
    expect(computeTotalCustomerPrice("0.10", "0.20")).toBe("0.30");
    expect(computeTotalCustomerPrice("199.99", "300.01")).toBe("500.00");
  });

  it("returns null when an input is missing or invalid", () => {
    expect(computeTotalCustomerPrice(500, null)).toBeNull();
    expect(computeTotalCustomerPrice("x", 300)).toBeNull();
  });
});

describe("resolveServicePricing", () => {
  it("derives basePrice from the split", () => {
    expect(resolveServicePricing({ semenPrice: 500, aiServiceCharge: 300 })).toEqual({
      ok: true,
      basePrice: "800.00",
      semenPrice: "500.00",
      aiServiceCharge: "300.00",
    });
  });

  it("accepts a matching explicit basePrice and rejects a different one", () => {
    expect(resolveServicePricing({ semenPrice: 500, aiServiceCharge: 300, basePrice: "800" }).ok).toBe(true);
    expect(resolveServicePricing({ semenPrice: 500, aiServiceCharge: 300, basePrice: 900 })).toEqual({
      ok: false,
      code: "PRICE_MISMATCH",
    });
  });

  it("allows a zero semen price (technician charges service only)", () => {
    const r = resolveServicePricing({ semenPrice: 0, aiServiceCharge: 300 });
    expect(r).toMatchObject({ ok: true, basePrice: "300.00" });
  });

  it("requires both halves of the split", () => {
    expect(resolveServicePricing({ semenPrice: 500 })).toEqual({ ok: false, code: "PRICE_INCOMPLETE" });
    expect(resolveServicePricing({ aiServiceCharge: 300 })).toEqual({ ok: false, code: "PRICE_INCOMPLETE" });
  });

  it("rejects invalid split amounts", () => {
    expect(resolveServicePricing({ semenPrice: "5.555", aiServiceCharge: 1 })).toEqual({
      ok: false,
      code: "INVALID_PRICE",
    });
  });

  it("legacy single price still works and has no split", () => {
    expect(resolveServicePricing({ basePrice: "450" })).toEqual({
      ok: true,
      basePrice: "450.00",
      semenPrice: null,
      aiServiceCharge: null,
    });
  });

  it("uses the fallback price only when none is supplied", () => {
    expect(resolveServicePricing({}, { fallbackBasePrice: "120.00" })).toMatchObject({
      ok: true,
      basePrice: "120.00",
    });
    expect(resolveServicePricing({ basePrice: 10 }, { fallbackBasePrice: "120.00" })).toMatchObject({
      basePrice: "10.00",
    });
    expect(resolveServicePricing({})).toEqual({ ok: false, code: "PRICE_REQUIRED" });
  });

  it("requirePositive rejects a zero price (catalog templates have no default price)", () => {
    expect(resolveServicePricing({}, { fallbackBasePrice: "0.00", requirePositive: true })).toEqual({
      ok: false,
      code: "PRICE_REQUIRED",
    });
    expect(
      resolveServicePricing({ semenPrice: 0, aiServiceCharge: 0 }, { requirePositive: true }),
    ).toEqual({ ok: false, code: "PRICE_REQUIRED" });
    expect(
      resolveServicePricing(
        { semenPrice: 500, aiServiceCharge: 300 },
        { fallbackBasePrice: "0.00", requirePositive: true },
      ),
    ).toMatchObject({ ok: true, basePrice: "800.00" });
  });
});
