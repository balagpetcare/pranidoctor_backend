import { describe, expect, it } from "vitest";

import { normalizeBdMobilePhone } from "./phone";

describe("normalizeBdMobilePhone", () => {
  it("accepts 01XXXXXXXXX", () => {
    expect(normalizeBdMobilePhone("01711223344")).toBe("8801711223344");
  });

  it("accepts +8801XXXXXXXXX", () => {
    expect(normalizeBdMobilePhone("+8801711223344")).toBe("8801711223344");
  });

  it("accepts 8801… without plus", () => {
    expect(normalizeBdMobilePhone("8801711223344")).toBe("8801711223344");
  });

  it("strips spaces and dashes", () => {
    expect(normalizeBdMobilePhone("01711 223-344")).toBe("8801711223344");
  });

  it("rejects invalid input", () => {
    expect(normalizeBdMobilePhone("abc")).toBeNull();
    expect(normalizeBdMobilePhone("008801711223344")).toBeNull();
  });
});
