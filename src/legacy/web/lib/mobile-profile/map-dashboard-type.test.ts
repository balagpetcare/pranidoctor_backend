import { describe, expect, it } from "vitest";

import { AiTechnicianStatus, UserRole } from "@/generated/prisma/client";

import { mapDashboardType } from "./map-dashboard-type";

describe("mapDashboardType", () => {
  it("returns DOCTOR when role is DOCTOR and doctor profile exists", () => {
    expect(
      mapDashboardType({
        role: UserRole.DOCTOR,
        doctorProfileId: "dp1",
        aiTechnicianStatus: null,
      }),
    ).toBe("DOCTOR");
  });

  it("returns GENERAL for DOCTOR without doctor profile", () => {
    expect(
      mapDashboardType({
        role: UserRole.DOCTOR,
        doctorProfileId: null,
        aiTechnicianStatus: null,
      }),
    ).toBe("GENERAL");
  });

  it("returns AI_TECHNICIAN for APPROVED / PUBLISHED", () => {
    expect(
      mapDashboardType({
        role: UserRole.AI_TECHNICIAN,
        doctorProfileId: null,
        aiTechnicianStatus: AiTechnicianStatus.APPROVED,
      }),
    ).toBe("AI_TECHNICIAN");
    expect(
      mapDashboardType({
        role: UserRole.AI_TECHNICIAN,
        doctorProfileId: null,
        aiTechnicianStatus: AiTechnicianStatus.PUBLISHED,
      }),
    ).toBe("AI_TECHNICIAN");
  });

  it("returns GENERAL for draft / submitted / review / correction / rejected / suspended", () => {
    const generalStatuses = [
      AiTechnicianStatus.DRAFT,
      AiTechnicianStatus.SUBMITTED,
      AiTechnicianStatus.UNDER_REVIEW,
      AiTechnicianStatus.NEEDS_CORRECTION,
      AiTechnicianStatus.REJECTED,
      AiTechnicianStatus.SUSPENDED,
    ] as const;
    for (const s of generalStatuses) {
      expect(
        mapDashboardType({
          role: UserRole.CUSTOMER,
          doctorProfileId: null,
          aiTechnicianStatus: s,
        }),
      ).toBe("GENERAL");
    }
  });

  it("returns GENERAL for AI_TECHNICIAN role until status is approved or published", () => {
    expect(
      mapDashboardType({
        role: UserRole.AI_TECHNICIAN,
        doctorProfileId: null,
        aiTechnicianStatus: AiTechnicianStatus.UNDER_REVIEW,
      }),
    ).toBe("GENERAL");
  });

  it("returns GENERAL for customer without AI profile", () => {
    expect(
      mapDashboardType({
        role: UserRole.CUSTOMER,
        doctorProfileId: null,
        aiTechnicianStatus: null,
      }),
    ).toBe("GENERAL");
  });

  it("prefers DOCTOR over AI technician when both exist (defensive)", () => {
    expect(
      mapDashboardType({
        role: UserRole.DOCTOR,
        doctorProfileId: "dp",
        aiTechnicianStatus: AiTechnicianStatus.APPROVED,
      }),
    ).toBe("DOCTOR");
  });
});
