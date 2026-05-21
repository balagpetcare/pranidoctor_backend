import { describe, expect, it } from "vitest";

import { getSafeAdminNextPath } from "./safe-next-path";

describe("getSafeAdminNextPath", () => {
  it("returns /admin for null, undefined, or empty", () => {
    expect(getSafeAdminNextPath(null)).toBe("/admin");
    expect(getSafeAdminNextPath(undefined)).toBe("/admin");
    expect(getSafeAdminNextPath("")).toBe("/admin");
  });

  it("accepts safe internal admin paths", () => {
    expect(getSafeAdminNextPath("/admin")).toBe("/admin");
    expect(getSafeAdminNextPath("/admin/areas")).toBe("/admin/areas");
  });

  it("rejects open redirects and external URLs", () => {
    expect(getSafeAdminNextPath("//evil.com")).toBe("/admin");
    expect(getSafeAdminNextPath("/admin\\evil")).toBe("/admin");
    expect(getSafeAdminNextPath("https://evil.com")).toBe("/admin");
  });

  it("rejects non-admin paths", () => {
    expect(getSafeAdminNextPath("/customer")).toBe("/admin");
    expect(getSafeAdminNextPath("/api/admin")).toBe("/admin");
  });
});
