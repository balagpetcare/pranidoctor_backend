import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";

const prismaMock = vi.hoisted(() => {
  const m: any = {
    aiTechnicianProfile: { findUnique: vi.fn() },
    aiTechnicianService: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    semenServiceTemplate: { findFirst: vi.fn() },
    technicianSemenInventory: { create: vi.fn() },
  };
  m.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(m));
  return m;
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./semen-inventory-service", () => ({
  aggregateStockForService: vi.fn(async () => ({ available: 0, lots: 0 })),
}));

import { createTechnicianServiceFromTemplate } from "./semen-from-template-service";
import {
  createTechnicianServiceForMobileUser,
  patchTechnicianServiceForMobileUser,
  serializeAiTechnicianServiceForMobile,
} from "./technician-services-service";

const D = (v: string | number) => new Prisma.Decimal(v);

function profile(status: string) {
  prismaMock.aiTechnicianProfile.findUnique.mockResolvedValue({ id: "prof_1", status });
}

function catalogTemplate(defaultBasePrice = "0.00") {
  return {
    id: "tpl_1",
    internalName: "Holstein Friesian (HF) 75% - BRAC Semen AI Service",
    animalType: "CATTLE",
    shortDescription: "Genetic composition: 75% Holstein Friesian + 25% Indigenous / Local Breed.",
    defaultBasePrice: D(defaultBasePrice),
    defaultOfferPrice: null,
    defaultDiscountPercent: null,
    breedMixes: [
      { percentage: D("75.00"), breed: { nameEn: "Holstein Friesian" } },
      { percentage: D("25.00"), breed: { nameEn: "Local" } },
    ],
  };
}

function serviceRow(over: Record<string, unknown> = {}) {
  return {
    id: "svc_1",
    aiTechnicianId: "prof_1",
    title: "Test",
    animalType: "CATTLE",
    breedOrSemenType: null,
    description: null,
    basePrice: D("800.00"),
    semenPrice: D("500.00"),
    aiServiceCharge: D("300.00"),
    visitFee: null,
    emergencyFee: null,
    repeatServicePolicy: null,
    followUpIncluded: false,
    status: "DRAFT",
    createdAt: new Date("2026-11-07T00:00:00Z"),
    updatedAt: new Date("2026-11-07T00:00:00Z"),
    semenServiceTemplateId: "tpl_1",
    offerPrice: null,
    discountPercent: null,
    isAvailable: true,
    technicianServiceNote: null,
    semenServiceTemplate: null,
    semenInventoryLots: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
  prismaMock.aiTechnicianService.findFirst.mockResolvedValue(null);
});

describe("service from a catalog template — technician-controlled pricing", () => {
  it("semen price 500 + AI service charge 300 => customer price 800", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    prismaMock.aiTechnicianService.create.mockResolvedValue({ id: "svc_1" });
    prismaMock.aiTechnicianService.findUniqueOrThrow.mockResolvedValue(serviceRow());

    const result = await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
      aiServiceCharge: 300,
    } as any);

    expect(result.ok).toBe(true);
    const data = prismaMock.aiTechnicianService.create.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("800");
    expect(data.semenPrice.toString()).toBe("500");
    expect(data.aiServiceCharge.toString()).toBe("300");
    expect(data.aiTechnicianId).toBe("prof_1");
    expect(data.semenServiceTemplateId).toBe("tpl_1");
    expect(data.status).toBe("DRAFT");
    expect(data.isAvailable).toBe(true);
  });

  it("lets the technician deactivate the listing at creation", async () => {
    profile("PUBLISHED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    prismaMock.aiTechnicianService.create.mockResolvedValue({ id: "svc_1" });
    prismaMock.aiTechnicianService.findUniqueOrThrow.mockResolvedValue(serviceRow({ isAvailable: false }));
    await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
      aiServiceCharge: 300,
      isAvailable: false,
    } as any);
    expect(prismaMock.aiTechnicianService.create.mock.calls[0][0].data.isAvailable).toBe(false);
  });

  it("refuses to save a catalog template with no price (the catalog has no default price)", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate("0.00"));
    const result = await createTechnicianServiceFromTemplate("user_1", { templateId: "tpl_1" } as any);
    expect(result).toEqual({ ok: "PRICING_ERROR", code: "PRICE_REQUIRED" });
    expect(prismaMock.aiTechnicianService.create).not.toHaveBeenCalled();
  });

  it("refuses an explicit total that does not equal semen price + AI charge", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    const result = await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
      aiServiceCharge: 300,
      basePrice: 900,
    } as any);
    expect(result).toEqual({ ok: "PRICING_ERROR", code: "PRICE_MISMATCH" });
    expect(prismaMock.aiTechnicianService.create).not.toHaveBeenCalled();
  });

  it("requires both halves of the split", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    const result = await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
    } as any);
    expect(result).toEqual({ ok: "PRICING_ERROR", code: "PRICE_INCOMPLETE" });
  });

  it("keeps working for legacy templates that carry an admin default price", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate("250.00"));
    prismaMock.aiTechnicianService.create.mockResolvedValue({ id: "svc_1" });
    prismaMock.aiTechnicianService.findUniqueOrThrow.mockResolvedValue(serviceRow());
    const result = await createTechnicianServiceFromTemplate("user_1", { templateId: "tpl_1" } as any);
    expect(result.ok).toBe(true);
    const data = prismaMock.aiTechnicianService.create.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("250");
    expect(data.semenPrice).toBeNull();
    expect(data.aiServiceCharge).toBeNull();
  });

  it("still rejects offer price and discount together", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    const result = await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
      aiServiceCharge: 300,
      offerPrice: 700,
      discountPercent: 5,
    } as any);
    expect(result).toEqual({ ok: "OFFER_DISCOUNT_BOTH" });
  });

  it("does not create a second service from the same template (duplicate protection)", async () => {
    profile("APPROVED");
    prismaMock.semenServiceTemplate.findFirst.mockResolvedValue(catalogTemplate());
    prismaMock.aiTechnicianService.findFirst.mockResolvedValue({ id: "existing" });
    const result = await createTechnicianServiceFromTemplate("user_1", {
      templateId: "tpl_1",
      semenPrice: 500,
      aiServiceCharge: 300,
    } as any);
    expect(result).toEqual({ ok: "DUPLICATE_TEMPLATE_SERVICE" });
  });
});

describe("technician permissions", () => {
  it.each(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "NEEDS_CORRECTION", "REJECTED", "SUSPENDED"])(
    "a %s technician cannot create services from templates",
    async (status) => {
      profile(status);
      const result = await createTechnicianServiceFromTemplate("user_1", {
        templateId: "tpl_1",
        semenPrice: 500,
        aiServiceCharge: 300,
      } as any);
      expect(result.ok).toBe("NOT_ALLOWED");
      expect(prismaMock.aiTechnicianService.create).not.toHaveBeenCalled();
      expect(prismaMock.semenServiceTemplate.findFirst).not.toHaveBeenCalled();
    },
  );

  it("a user without a technician profile is rejected", async () => {
    prismaMock.aiTechnicianProfile.findUnique.mockResolvedValue(null);
    const result = await createTechnicianServiceFromTemplate("user_1", { templateId: "tpl_1" } as any);
    expect(result.ok).toBe("NO_PROFILE");
  });

  it("only APPROVED / PUBLISHED technicians may create custom (manual) services", async () => {
    profile("UNDER_REVIEW");
    const denied = await createTechnicianServiceForMobileUser("user_1", {
      title: "Custom",
      animalType: "CATTLE",
      semenPrice: 400,
      aiServiceCharge: 200,
    } as any);
    expect(denied.ok).toBe("NOT_ALLOWED");
    expect(prismaMock.aiTechnicianService.create).not.toHaveBeenCalled();
  });

  it("the catalog only offers a technician's own services for editing", async () => {
    profile("APPROVED");
    prismaMock.aiTechnicianService.findFirst.mockResolvedValue(null);
    const result = await patchTechnicianServiceForMobileUser("user_1", "someone_elses_service", {
      aiServiceCharge: 100,
    });
    expect(result.ok).toBe("NOT_FOUND");
    expect(prismaMock.aiTechnicianService.findFirst.mock.calls[0][0].where).toEqual({
      id: "someone_elses_service",
      aiTechnicianId: "prof_1",
    });
    expect(prismaMock.aiTechnicianService.update).not.toHaveBeenCalled();
  });
});

describe("custom service combinations (manual create)", () => {
  it("derives the customer price from semen price + AI charge", async () => {
    profile("PUBLISHED");
    prismaMock.aiTechnicianService.create.mockResolvedValue({ id: "svc_9" });
    prismaMock.aiTechnicianService.findUniqueOrThrow.mockResolvedValue(
      serviceRow({ id: "svc_9", semenServiceTemplateId: null }),
    );
    const result = await createTechnicianServiceForMobileUser("user_1", {
      title: "Custom supplier HF 80%",
      animalType: "CATTLE",
      breedOrSemenType: "HF 80% - local supplier",
      semenPrice: "450.50",
      aiServiceCharge: "250",
    } as any);
    expect(result.ok).toBe(true);
    const data = prismaMock.aiTechnicianService.create.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("700.5");
    expect(data.semenPrice.toString()).toBe("450.5");
    expect(data.aiServiceCharge.toString()).toBe("250");
    expect(data.status).toBe("DRAFT");
  });

  it("the old single-price request still works unchanged", async () => {
    profile("APPROVED");
    prismaMock.aiTechnicianService.create.mockResolvedValue({ id: "svc_9" });
    prismaMock.aiTechnicianService.findUniqueOrThrow.mockResolvedValue(serviceRow({ id: "svc_9" }));
    await createTechnicianServiceForMobileUser("user_1", {
      title: "Legacy",
      animalType: "CATTLE",
      basePrice: 600,
    } as any);
    const data = prismaMock.aiTechnicianService.create.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("600");
    expect(data.semenPrice).toBeNull();
  });

  it("rejects a manual service with no usable price", async () => {
    profile("APPROVED");
    const result = await createTechnicianServiceForMobileUser("user_1", {
      title: "No price",
      animalType: "CATTLE",
    } as any);
    expect(result).toEqual({ ok: "PRICING_ERROR", code: "PRICE_REQUIRED" });
  });
});

describe("editing prices on an existing service", () => {
  function existing(over: Record<string, unknown> = {}) {
    prismaMock.aiTechnicianService.findFirst.mockResolvedValue(serviceRow(over));
    prismaMock.aiTechnicianService.update.mockImplementation(async ({ data }: any) =>
      serviceRow({
        basePrice: data.basePrice ?? D("800.00"),
        semenPrice: data.semenPrice === undefined ? D("500.00") : data.semenPrice,
        aiServiceCharge: data.aiServiceCharge === undefined ? D("300.00") : data.aiServiceCharge,
      }),
    );
  }

  it("changing only the AI charge re-derives the total from the stored semen price", async () => {
    profile("APPROVED");
    existing();
    const result = await patchTechnicianServiceForMobileUser("user_1", "svc_1", { aiServiceCharge: 350 });
    expect(result.ok).toBe(true);
    const data = prismaMock.aiTechnicianService.update.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("850");
    expect(data.semenPrice.toString()).toBe("500");
    expect(data.aiServiceCharge.toString()).toBe("350");
  });

  it("changing only the semen price re-derives the total from the stored AI charge", async () => {
    profile("APPROVED");
    existing();
    await patchTechnicianServiceForMobileUser("user_1", "svc_1", { semenPrice: "620.25" });
    const data = prismaMock.aiTechnicianService.update.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("920.25");
  });

  it("an older client sending only basePrice clears the split so it can never disagree", async () => {
    profile("APPROVED");
    existing();
    await patchTechnicianServiceForMobileUser("user_1", "svc_1", { basePrice: 900 });
    const data = prismaMock.aiTechnicianService.update.mock.calls[0][0].data;
    expect(data.basePrice.toString()).toBe("900");
    expect(data.semenPrice).toBeNull();
    expect(data.aiServiceCharge).toBeNull();
  });

  it("clearing both split fields keeps the stored customer price", async () => {
    profile("APPROVED");
    existing();
    await patchTechnicianServiceForMobileUser("user_1", "svc_1", { semenPrice: null, aiServiceCharge: null });
    const data = prismaMock.aiTechnicianService.update.mock.calls[0][0].data;
    expect(data).toEqual({ semenPrice: null, aiServiceCharge: null });
  });

  it("rejects an explicit basePrice that disagrees with the split", async () => {
    profile("APPROVED");
    existing();
    const result = await patchTechnicianServiceForMobileUser("user_1", "svc_1", {
      semenPrice: 500,
      aiServiceCharge: 300,
      basePrice: 999,
    });
    expect(result).toEqual({ ok: "PRICING_ERROR", code: "PRICE_MISMATCH" });
    expect(prismaMock.aiTechnicianService.update).not.toHaveBeenCalled();
  });

  it("can activate / deactivate the listing and keeps offer XOR discount", async () => {
    profile("APPROVED");
    existing();
    await patchTechnicianServiceForMobileUser("user_1", "svc_1", { isAvailable: false });
    expect(prismaMock.aiTechnicianService.update.mock.calls[0][0].data).toEqual({ isAvailable: false });

    const both = await patchTechnicianServiceForMobileUser("user_1", "svc_1", {
      offerPrice: 700,
      discountPercent: 10,
    });
    expect(both.ok).toBe("VALIDATION_ERROR");
  });

  it("a REJECTED template-backed service cannot be edited", async () => {
    profile("APPROVED");
    existing({ status: "REJECTED" });
    const result = await patchTechnicianServiceForMobileUser("user_1", "svc_1", { aiServiceCharge: 100 });
    expect(result.ok).toBe("NOT_EDITABLE");
    expect(prismaMock.aiTechnicianService.update).not.toHaveBeenCalled();
  });

  it("an unapproved technician cannot edit prices", async () => {
    profile("SUSPENDED");
    const result = await patchTechnicianServiceForMobileUser("user_1", "svc_1", { aiServiceCharge: 100 });
    expect(result.ok).toBe("NOT_ALLOWED");
    expect(prismaMock.aiTechnicianService.update).not.toHaveBeenCalled();
  });
});

describe("serialisation", () => {
  it("exposes the split and the total customer price", async () => {
    const out: any = await serializeAiTechnicianServiceForMobile(serviceRow() as any);
    expect(out.semenPrice).toBe("500");
    expect(out.aiServiceCharge).toBe("300");
    expect(out.basePrice).toBe("800");
    expect(out.totalCustomerPrice).toBe("800");
  });

  it("returns null split for legacy single-price services", async () => {
    const out: any = await serializeAiTechnicianServiceForMobile(
      serviceRow({ semenPrice: null, aiServiceCharge: null, basePrice: D("450.00") }) as any,
    );
    expect(out.semenPrice).toBeNull();
    expect(out.aiServiceCharge).toBeNull();
    expect(out.totalCustomerPrice).toBe("450");
  });
});
