import { describe, expect, it } from "vitest";

import { AnimalType } from "@/generated/prisma/client";

import { estimateWeightFromTape, isTapeSupported } from "./tape-formula-registry";

describe("tape-formula-registry", () => {
  it("rejects poultry tape", () => {
    expect(isTapeSupported(AnimalType.POULTRY)).toBe(false);
  });

  it("estimates goat weight", () => {
    const result = estimateWeightFromTape({
      animalType: AnimalType.GOAT,
      heartGirthCm: 70,
      bodyLengthCm: 65,
    });
    expect(result.formulaId).toBe("SMALL_RUMINANT_METRIC_V1");
    expect(result.estimatedKg).toBeGreaterThan(0);
  });
});
