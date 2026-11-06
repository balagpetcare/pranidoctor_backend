import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildServiceKey, validateCatalog, type CattleAiCatalog } from "./catalog-schema";

const CATALOG_PATH = path.resolve(__dirname, "../../../../../prisma/seed-data/cattle-ai-service-catalog.json");

function loadRaw(): any {
  return JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
}

function loadValid(): CattleAiCatalog {
  const r = validateCatalog(loadRaw());
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.catalog;
}

describe("shipped catalog file", () => {
  it("passes validation", () => {
    const r = validateCatalog(loadRaw());
    expect(r.ok).toBe(true);
  });

  it("stores the Holstein Friesian and Sahiwal genetic percentages exactly as specified", () => {
    const c = loadValid();
    const pcts = (key: string) => c.breeds.find((b) => b.key === key)!.geneticPercentages;
    expect(pcts("holstein-friesian")).toEqual([50, 62.5, 68.75, 75, 87.5, 93.75, 100]);
    expect(pcts("sahiwal")).toEqual([50, 62.5, 75, 87.5, 100]);
  });

  it("contains every requested other breed and supplier", () => {
    const c = loadValid();
    expect(c.breeds.map((b) => b.nameEn)).toEqual(
      expect.arrayContaining([
        "Brahman",
        "Red Chittagong Cattle (RCC)",
        "North Bengal Grey",
        "Pabna Cattle",
        "Munshiganj Cattle",
        "Jersey",
        "Indigenous / Local Breed",
      ]),
    );
    expect(c.suppliers.map((s) => s.name)).toEqual([
      "BRAC",
      "Department of Livestock Services (DLS)",
      "ACI Animal Genetics",
      "Milk Vita",
      "Lal Teer",
      "Other / Custom Supplier",
    ]);
    expect(c.suppliers.filter((s) => s.isCustom).map((s) => s.key)).toEqual(["other-custom"]);
  });

  it("has one row per supplier x breed x percentage (6 x 19 = 114)", () => {
    const c = loadValid();
    expect(c.services).toHaveLength(114);
    expect(new Set(c.services.map((s) => s.key)).size).toBe(114);
    for (const s of c.suppliers) {
      expect(c.services.filter((x) => x.semenSupplier === s.key)).toHaveLength(19);
    }
  });

  it("every row has the required fields and a derived key / name", () => {
    const c = loadValid();
    for (const s of c.services) {
      expect(s.animalSpecies).toBe("CATTLE");
      expect(s.serviceCategory).toBe("ai-service");
      expect(s.isActive).toBe(true);
      expect(s.key).toBe(buildServiceKey(s.semenSupplier, s.breedKey, s.geneticPercentage));
      expect(s.defaultServiceName).toContain(`${s.geneticPercentage}%`);
    }
  });

  it("contains no price fields anywhere", () => {
    const text = readFileSync(CATALOG_PATH, "utf8");
    expect(text).not.toMatch(/"(price|basePrice|semenPrice|aiServiceCharge|offerPrice|defaultBasePrice|fee|cost)"/i);
  });

  it("reports Murrah Buffalo as unsupported instead of inventing a buffalo animal type", () => {
    const c = loadValid();
    expect(c.unsupported.map((u) => u.name)).toEqual(["Murrah Buffalo"]);
    expect(c.services.some((s) => /murrah/i.test(s.breedName))).toBe(false);
  });
});

describe("validateCatalog rejections", () => {
  const mutate = (fn: (raw: any) => void) => {
    const raw = loadRaw();
    fn(raw);
    return validateCatalog(raw);
  };

  it("rejects any price field", () => {
    const r = mutate((raw) => {
      raw.services[0].price = 500;
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/prices must not be stored/);
  });

  it("rejects an unknown supplier or breed reference", () => {
    const a = mutate((raw) => {
      raw.services[0].semenSupplier = "nobody";
    });
    expect(a.ok).toBe(false);
    const b = mutate((raw) => {
      raw.services[0].breedKey = "unicorn";
    });
    expect(b.ok).toBe(false);
  });

  it("rejects a percentage that is not offered for the breed", () => {
    const r = mutate((raw) => {
      const row = raw.services.find((s: any) => s.breedKey === "sahiwal" && s.geneticPercentage === 75);
      row.geneticPercentage = 68.75;
      row.key = buildServiceKey(row.semenSupplier, row.breedKey, 68.75);
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("\n")).toMatch(/not offered for breed "sahiwal"/);
  });

  it("rejects out-of-range or over-precise percentages", () => {
    for (const bad of [0, 101, 62.555]) {
      const r = mutate((raw) => {
        raw.breeds[0].geneticPercentages.push(bad);
      });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects duplicate service keys, breed codes and a wrong key", () => {
    expect(mutate((raw) => raw.services.push({ ...raw.services[0] })).ok).toBe(false);
    expect(
      mutate((raw) => {
        raw.breeds[1].code = raw.breeds[0].code;
      }).ok,
    ).toBe(false);
    expect(
      mutate((raw) => {
        raw.services[0].key = "brac:wrong:50";
      }).ok,
    ).toBe(false);
  });

  it("rejects an unsupported species row and a missing remainder breed", () => {
    expect(
      mutate((raw) => {
        raw.services[0].animalSpecies = "BUFFALO";
      }).ok,
    ).toBe(false);
    expect(
      mutate((raw) => {
        raw.defaults.remainderBreedSlug = "cattle-not-there";
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown top-level keys and a wrong schema version", () => {
    expect(mutate((raw) => (raw.extra = 1)).ok).toBe(false);
    expect(mutate((raw) => (raw.schemaVersion = 2)).ok).toBe(false);
  });
});
