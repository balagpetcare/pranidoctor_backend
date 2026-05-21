import { describe, expect, it } from "vitest";

import { AnimalType } from "@/generated/prisma/client";

import { listMobileProvidersQuerySchema } from "./schemas";

describe("listMobileProvidersQuerySchema", () => {
  it("parses minimal query", () => {
    const r = listMobileProvidersQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBeUndefined();
    }
  });

  it("rejects areaId and areaSlug together", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      areaId: "clckqjgmi0000mg9vzq2m3x1a",
      areaSlug: "dhaka-division",
    });
    expect(r.success).toBe(false);
  });

  it("normalizes animalType to uppercase", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      animalType: "cattle",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.animalType).toBe(AnimalType.CATTLE);
    }
  });

  it("rejects invalid animalType string", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      animalType: "not_an_animal",
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid serviceCategoryId (non-cuid)", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      serviceCategoryId: "not-a-cuid",
    });
    expect(r.success).toBe(false);
  });

  it("parses booleans from true/false strings", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      emergency: "true",
      homeVisit: "false",
      onlineConsultation: "true",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.emergency).toBe(true);
      expect(r.data.homeVisit).toBe(false);
      expect(r.data.onlineConsultation).toBe(true);
    }
  });

  it("coerces limit and page", () => {
    const r = listMobileProvidersQuerySchema.safeParse({
      limit: "10",
      page: "2",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(10);
      expect(r.data.page).toBe(2);
    }
  });
});
