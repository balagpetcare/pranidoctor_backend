import { describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import type { AdminJwtPayload } from "./jwt";
import { classifyAdminPanelAuth } from "./panel-classify";

const sampleSession: AdminJwtPayload = {
  sub: "user_1",
  email: "a@b.com",
  role: "ADMIN",
};

const sampleActor = {
  id: "user_1",
  email: "a@b.com",
  displayName: "Admin",
  role: UserRole.ADMIN,
};

describe("classifyAdminPanelAuth", () => {
  it("returns unauthenticated when session is null", () => {
    expect(classifyAdminPanelAuth(null, null)).toBe("unauthenticated");
    expect(classifyAdminPanelAuth(null, sampleActor)).toBe("unauthenticated");
  });

  it("returns forbidden when session exists but actor is null", () => {
    expect(classifyAdminPanelAuth(sampleSession, null)).toBe("forbidden");
  });

  it("returns ok when both session and actor are present", () => {
    expect(classifyAdminPanelAuth(sampleSession, sampleActor)).toBe("ok");
  });
});
