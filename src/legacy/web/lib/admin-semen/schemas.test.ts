import { describe, expect, it } from "vitest";

import { AnimalType, SemenProductKind, SemenTemplateApprovalStatus } from "@/generated/prisma/client";

import {
  createSemenServiceTemplateBodySchema,
  listLivestockBreedsQuerySchema,
  listSemenTemplatesQuerySchema,
  patchSemenServiceTemplateBodySchema,
} from "@/lib/admin-semen/schemas";

const minimalValidCreate = {
  internalName: "Test template",
  animalType: AnimalType.CATTLE,
  semenProviderId: "prov_1",
  semenProductKind: SemenProductKind.NORMAL,
  defaultBasePrice: "100",
  breedMix: [{ breedId: "breed_1", percentage: 100 }],
  media: [],
};

describe("listSemenTemplatesQuerySchema", () => {
  it("accepts limit 100", () => {
    const r = listSemenTemplatesQuerySchema.safeParse({ limit: "100" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(100);
  });
});

describe("listLivestockBreedsQuerySchema", () => {
  it("accepts limit 200 from query-string style input", () => {
    const r = listLivestockBreedsQuerySchema.safeParse({ limit: "200" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(200);
  });

  it("rejects limit above 200", () => {
    const r = listLivestockBreedsQuerySchema.safeParse({ limit: "201" });
    expect(r.success).toBe(false);
  });

  it("coerces offset and accepts animalType / isActive strings", () => {
    const r = listLivestockBreedsQuerySchema.safeParse({
      offset: "10",
      animalType: AnimalType.CATTLE,
      isActive: "true",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.offset).toBe(10);
      expect(r.data.animalType).toBe(AnimalType.CATTLE);
      expect(r.data.isActive).toBe("true");
    }
  });
});

describe("createSemenServiceTemplateBodySchema", () => {
  it("accepts breed mix summing to 100", () => {
    const r = createSemenServiceTemplateBodySchema.safeParse(minimalValidCreate);
    expect(r.success).toBe(true);
  });

  it("rejects REJECTED without rejectedReason", () => {
    const r = createSemenServiceTemplateBodySchema.safeParse({
      ...minimalValidCreate,
      approvalStatus: SemenTemplateApprovalStatus.REJECTED,
    });
    expect(r.success).toBe(false);
  });

  it("accepts REJECTED with rejectedReason", () => {
    const r = createSemenServiceTemplateBodySchema.safeParse({
      ...minimalValidCreate,
      approvalStatus: SemenTemplateApprovalStatus.REJECTED,
      rejectedReason: "Missing documents",
    });
    expect(r.success).toBe(true);
  });

  it("rejects breed mix not summing to 100 (422-style validation, not thrown at schema init)", () => {
    const r = createSemenServiceTemplateBodySchema.safeParse({
      ...minimalValidCreate,
      breedMix: [
        { breedId: "a", percentage: 40 },
        { breedId: "b", percentage: 40 },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("patchSemenServiceTemplateBodySchema", () => {
  it("accepts empty partial body", () => {
    const r = patchSemenServiceTemplateBodySchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts only isActive", () => {
    const r = patchSemenServiceTemplateBodySchema.safeParse({ isActive: false });
    expect(r.success).toBe(true);
  });

  it("rejects both offer and discount when both keys are set with values", () => {
    const r = patchSemenServiceTemplateBodySchema.safeParse({
      defaultOfferPrice: "10",
      defaultDiscountPercent: 5,
    });
    expect(r.success).toBe(false);
  });

  it("does not run XOR when neither pricing field is present", () => {
    const r = patchSemenServiceTemplateBodySchema.safeParse({ internalName: "Renamed" });
    expect(r.success).toBe(true);
  });

  it("validates breed mix sum only when breedMix key is present", () => {
    const bad = patchSemenServiceTemplateBodySchema.safeParse({
      breedMix: [{ breedId: "x", percentage: 50 }],
    });
    expect(bad.success).toBe(false);

    const ok = patchSemenServiceTemplateBodySchema.safeParse({
      breedMix: [{ breedId: "x", percentage: 100 }],
    });
    expect(ok.success).toBe(true);
  });

  it("requires rejectedReason when patching approvalStatus to REJECTED", () => {
    const bad = patchSemenServiceTemplateBodySchema.safeParse({
      approvalStatus: SemenTemplateApprovalStatus.REJECTED,
    });
    expect(bad.success).toBe(false);

    const ok = patchSemenServiceTemplateBodySchema.safeParse({
      approvalStatus: SemenTemplateApprovalStatus.REJECTED,
      rejectedReason: "Incomplete",
    });
    expect(ok.success).toBe(true);
  });
});
