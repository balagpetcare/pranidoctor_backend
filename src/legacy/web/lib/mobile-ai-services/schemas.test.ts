import { describe, expect, it } from "vitest";

import {
  createAiServiceRequestBodySchema,
  listAiServiceTechniciansQuerySchema,
} from "@/lib/mobile-ai-services/schemas";

describe("mobile-ai-services schemas", () => {
  it("parses technician list query", () => {
    const r = listAiServiceTechniciansQuerySchema.safeParse({
      district: " ঢাকা ",
      upazila: "সাভার",
      unionOrArea: "আশুলিয়া",
      animalType: "CATTLE",
      emergency: "true",
      limit: "10",
      offset: "0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.district).toBe("ঢাকা");
      expect(r.data.upazila).toBe("সাভার");
    }
  });

  it("parses create AI service request body", () => {
    const r = createAiServiceRequestBodySchema.safeParse({
      animalType: "GOAT",
      district: "রাজশাহী",
      upazila: "পবা",
      addressDetail: "গ্রামের বাড়ি",
      technicianProfileId: "tech1",
      isEmergency: false,
    });
    expect(r.success).toBe(true);
  });
});
