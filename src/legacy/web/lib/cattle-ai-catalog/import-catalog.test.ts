import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { validateCatalog, type CattleAiCatalog } from "./catalog-schema";
import {
  CatalogImportError,
  buildBreedMix,
  importCattleAiCatalog,
  type CatalogDb,
  type CatalogTx,
  type ExistingTemplateRow,
  type NewTemplateData,
} from "./import-catalog";

const CATALOG_PATH = path.resolve(__dirname, "../../../../../prisma/seed-data/cattle-ai-service-catalog.json");

function loadCatalog(mutate?: (raw: any) => void): CattleAiCatalog {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
  mutate?.(raw);
  const r = validateCatalog(raw);
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.catalog;
}

type ProviderRow = { id: string; slug: string; name: string; nameBn: string; sortOrder: number };
type BreedRow = { id: string; slug: string; nameEn: string; nameBn: string; animalType: string };
type TemplateRow = NewTemplateData & { id: string };
type State = { providers: ProviderRow[]; breeds: BreedRow[]; templates: TemplateRow[]; categories: string[] };

/** In-memory CatalogDb with real transaction semantics (snapshot + rollback on throw). */
class FakeDb implements CatalogDb {
  state: State;
  private seq = 0;
  /** Throw when this many templates have been created in one transaction (rollback test). */
  failAfterTemplates: number | null = null;
  transactions = 0;
  lockCalls = 0;

  constructor(seed?: Partial<State>) {
    this.state = { providers: [], breeds: [], templates: [], categories: ["ai-service"], ...seed };
  }

  private id(prefix: string) {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  async transaction<T>(fn: (tx: CatalogTx) => Promise<T>): Promise<T> {
    this.transactions += 1;
    const snapshot = structuredClone(this.state);
    let created = 0;
    const s = this.state;
    const tx: CatalogTx = {
      acquireImportLock: async () => {
        this.lockCalls += 1;
      },
      findProviderBySlug: async (slug) => s.providers.find((p) => p.slug === slug) ?? null,
      createProvider: async (d) => {
        const row = { id: this.id("prov"), ...d };
        s.providers.push(row);
        return { id: row.id };
      },
      findBreedBySlug: async (slug) => s.breeds.find((b) => b.slug === slug) ?? null,
      createBreed: async (d) => {
        const row = { id: this.id("breed"), ...d };
        s.breeds.push(row);
        return { id: row.id };
      },
      listCattleTemplatesForProviders: async (ids): Promise<ExistingTemplateRow[]> =>
        s.templates
          .filter((t) => ids.includes(t.semenProviderId))
          .map((t) => ({
            id: t.id,
            internalName: t.internalName,
            semenProviderId: t.semenProviderId,
            tags: t.tags,
          })),
      createTemplate: async (d) => {
        if (this.failAfterTemplates !== null && created >= this.failAfterTemplates) {
          throw new Error("simulated database failure");
        }
        created += 1;
        const row = { id: this.id("tpl"), ...structuredClone(d) };
        s.templates.push(row);
        return { id: row.id };
      },
      serviceCategoryExists: async (slug) => s.categories.includes(slug),
    };
    try {
      return await fn(tx);
    } catch (e) {
      this.state = snapshot;
      throw e;
    }
  }
}

/** The masters already created by prisma/seed.ts (seedSemenReferenceMasters). */
function seededMasters(): Partial<State> {
  return {
    providers: [
      { id: "p_brac", slug: "brac", name: "BRAC", nameBn: "ব্র্যাক", sortOrder: 10 },
      { id: "p_aci", slug: "aci", name: "ACI", nameBn: "এসিআই", sortOrder: 20 },
      { id: "p_dls", slug: "dls-government", name: "DLS / Government", nameBn: "ডিএলএস / সরকারি", sortOrder: 40 },
      { id: "p_others", slug: "others", name: "Others", nameBn: "অন্যান্য", sortOrder: 60 },
    ],
    breeds: [
      { id: "b_hf", slug: "cattle-holstein-friesian", nameEn: "Holstein Friesian", nameBn: "হোলস্টাইন ফ্রিজিয়ান", animalType: "CATTLE" },
      { id: "b_sah", slug: "cattle-sahiwal", nameEn: "Sahiwal", nameBn: "সাহিওয়াল", animalType: "CATTLE" },
      { id: "b_jer", slug: "cattle-jersey", nameEn: "Jersey", nameBn: "জার্সি", animalType: "CATTLE" },
      { id: "b_bra", slug: "cattle-brahman", nameEn: "Brahman", nameBn: "ব্রাহমান", animalType: "CATTLE" },
      { id: "b_loc", slug: "cattle-local", nameEn: "Local", nameBn: "দেশি", animalType: "CATTLE" },
    ],
  };
}

const APPROVED = { dryRun: false, approvalStatus: "APPROVED" as const };

describe("buildBreedMix", () => {
  const c = loadCatalog();
  const hf = c.breeds.find((b) => b.key === "holstein-friesian")!;
  const local = c.breeds.find((b) => b.slug === "cattle-local")!;

  it("assigns the remainder of a graded line to the local breed", () => {
    expect(buildBreedMix(hf, 75, local)).toEqual([
      { breedKey: "holstein-friesian", percentage: 75 },
      { breedKey: "indigenous-local", percentage: 25 },
    ]);
    expect(buildBreedMix(hf, 62.5, local)[1].percentage).toBe(37.5);
    expect(buildBreedMix(hf, 68.75, local)[1].percentage).toBe(31.25);
    expect(buildBreedMix(hf, 93.75, local)[1].percentage).toBe(6.25);
  });

  it("uses a single 100% row for pure lines", () => {
    expect(buildBreedMix(hf, 100, local)).toEqual([{ breedKey: "holstein-friesian", percentage: 100 }]);
  });
});

describe("first import", () => {
  it("imports every catalog record (providers, breeds, 114 templates) into an empty database", async () => {
    const db = new FakeDb();
    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);

    expect(report.providers.created).toHaveLength(6);
    expect(report.breeds.created).toHaveLength(9);
    expect(report.templates).toMatchObject({ total: 114, created: 114, existing: 0 });
    expect(db.state.templates).toHaveLength(114);
    expect(db.lockCalls).toBe(1);
    expect(db.transactions).toBe(1);
  });

  it("stores genetic percentages exactly and every breed mix sums to 100", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);

    const hf625 = db.state.templates.find((t) => t.tags.includes("catalog-key:brac:holstein-friesian:62.5"))!;
    const hfId = db.state.breeds.find((b) => b.slug === "cattle-holstein-friesian")!.id;
    const localId = db.state.breeds.find((b) => b.slug === "cattle-local")!.id;
    expect(hf625.breedMix).toEqual([
      { breedId: hfId, percentage: "62.50" },
      { breedId: localId, percentage: "37.50" },
    ]);

    const hf6875 = db.state.templates.find((t) => t.tags.includes("catalog-key:aci:holstein-friesian:68.75"))!;
    expect(hf6875.breedMix.map((m) => m.percentage)).toEqual(["68.75", "31.25"]);

    for (const t of db.state.templates) {
      const sum = t.breedMix.reduce((a, m) => a + Math.round(Number(m.percentage) * 100), 0);
      expect(sum).toBe(10_000);
      expect(t.animalType).toBe("CATTLE");
    }
  });

  it("links every template to a valid supplier and valid breeds", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    const providerIds = new Set(db.state.providers.map((p) => p.id));
    const breedIds = new Set(db.state.breeds.map((b) => b.id));
    for (const t of db.state.templates) {
      expect(providerIds.has(t.semenProviderId)).toBe(true);
      for (const m of t.breedMix) expect(breedIds.has(m.breedId)).toBe(true);
    }
    // each supplier owns 19 templates
    for (const p of db.state.providers) {
      expect(db.state.templates.filter((t) => t.semenProviderId === p.id)).toHaveLength(19);
    }
  });

  it("never invents a price", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    for (const t of db.state.templates) expect(t.defaultBasePrice).toBe("0.00");
  });

  it("honours --approval-status and only stamps approvedAt for APPROVED", async () => {
    const fixed = new Date("2026-11-07T00:00:00Z");
    const approved = new FakeDb();
    await importCattleAiCatalog(approved, loadCatalog(), { ...APPROVED, now: () => fixed });
    expect(approved.state.templates.every((t) => t.approvalStatus === "APPROVED")).toBe(true);
    expect(approved.state.templates.every((t) => t.approvedAt?.getTime() === fixed.getTime())).toBe(true);

    const draft = new FakeDb();
    await importCattleAiCatalog(draft, loadCatalog(), { dryRun: false, approvalStatus: "DRAFT" });
    expect(draft.state.templates.every((t) => t.approvalStatus === "DRAFT" && t.approvedAt === null)).toBe(true);
  });

  it("respects isActive from the catalog", async () => {
    const db = new FakeDb();
    const catalog = loadCatalog((raw) => {
      raw.services.find((s: any) => s.key === "lal-teer:jersey:100").isActive = false;
    });
    const report = await importCattleAiCatalog(db, catalog, APPROVED);
    const t = db.state.templates.find((x) => x.tags.includes("catalog-key:lal-teer:jersey:100"))!;
    expect(t.isActive).toBe(false);
    expect(report.templates.createdInactive).toBe(1);
  });

  it("tags templates so they can be traced back to the catalog, and states availability is unverified", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    const t = db.state.templates.find((x) => x.tags.includes("catalog-key:milk-vita:sahiwal:87.5"))!;
    expect(t.tags).toEqual(
      expect.arrayContaining([
        "cattle-ai-catalog",
        "breed-code:SAH",
        "genetic-percent:87.5",
        "supplier:milk-vita",
        "service-category:ai-service",
        "availability:unverified",
      ]),
    );
    expect(t.internalName).toBe("Sahiwal (SAH) 87.5% - Milk Vita Semen AI Service");
  });

  it("reports Murrah Buffalo as unsupported", async () => {
    const report = await importCattleAiCatalog(new FakeDb(), loadCatalog(), APPROVED);
    expect(report.unsupported).toHaveLength(1);
    expect(report.unsupported[0].name).toBe("Murrah Buffalo");
  });
});

describe("existing seeded masters", () => {
  it("reuses providers and breeds created by prisma/seed.ts and does not rename them", async () => {
    const db = new FakeDb(seededMasters());
    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);

    expect(report.providers.existing.sort()).toEqual(["aci", "brac", "dls-government", "others"]);
    expect(report.providers.created.sort()).toEqual(["lal-teer", "milk-vita"]);
    expect(report.breeds.existing).toHaveLength(5);
    expect(report.breeds.created.sort()).toEqual([
      "cattle-munshiganj",
      "cattle-north-bengal-grey",
      "cattle-pabna",
      "cattle-red-chittagong",
    ]);

    expect(db.state.providers.find((p) => p.slug === "aci")!.name).toBe("ACI");
    expect(db.state.providers.find((p) => p.slug === "others")!.name).toBe("Others");
    expect(db.state.breeds.find((b) => b.slug === "cattle-local")!.nameEn).toBe("Local");
    expect(db.state.providers).toHaveLength(6);
    expect(db.state.breeds).toHaveLength(9);
  });

  it("fails (and writes nothing) when an existing breed slug is not a cattle breed", async () => {
    const seeded = seededMasters();
    seeded.breeds![0].animalType = "GOAT";
    const db = new FakeDb(seeded);
    await expect(importCattleAiCatalog(db, loadCatalog(), APPROVED)).rejects.toMatchObject({
      code: "BREED_ANIMAL_TYPE_MISMATCH",
    });
    expect(db.state.templates).toHaveLength(0);
    expect(db.state.providers).toHaveLength(4);
  });
});

describe("repeat runs (idempotency)", () => {
  it("creates nothing on the second run", async () => {
    const db = new FakeDb(seededMasters());
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    const before = structuredClone(db.state);

    const second = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(second.templates).toMatchObject({ created: 0, existing: 114 });
    expect(second.providers.created).toHaveLength(0);
    expect(second.breeds.created).toHaveLength(0);
    expect(db.state).toEqual(before);
  });

  it("can be run many times without ever duplicating a record", async () => {
    const db = new FakeDb();
    for (let i = 0; i < 4; i += 1) await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(db.state.templates).toHaveLength(114);
    expect(db.state.providers).toHaveLength(6);
    expect(db.state.breeds).toHaveLength(9);
    const keys = db.state.templates.map((t) => t.tags.find((x) => x.startsWith("catalog-key:")));
    expect(new Set(keys).size).toBe(114);
  });

  it("preserves admin edits: deactivation, status, description, price and breed mix survive a re-run", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);

    const t = db.state.templates.find((x) => x.tags.includes("catalog-key:brac:holstein-friesian:75"))!;
    t.isActive = false;
    t.approvalStatus = "REJECTED" as any;
    t.shortDescription = "Edited by admin";
    t.defaultBasePrice = "1234.00";
    t.breedMix = [{ breedId: "custom", percentage: "100.00" }];
    const edited = structuredClone(t);

    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(report.templates.created).toBe(0);
    expect(db.state.templates.find((x) => x.id === t.id)).toEqual(edited);
  });

  it("does not re-create a template an admin renamed when its catalog tag is still there", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    db.state.templates[0].internalName = "Renamed by admin";
    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(report.templates.created).toBe(0);
    expect(db.state.templates).toHaveLength(114);
  });

  it("falls back to provider + name when an admin removed the catalog tags", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    for (const t of db.state.templates) t.tags = [];
    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(report.templates.created).toBe(0);
    expect(db.state.templates).toHaveLength(114);
  });

  it("adds only the new rows when the catalog grows and leaves existing rows untouched", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    const before = structuredClone(db.state.templates);

    // Add one new genetic percentage (68.75) to the GRADED Sahiwal line for every supplier.
    const grown = loadCatalog((raw) => {
      raw.breeds.find((b: any) => b.key === "sahiwal").geneticPercentages.push(68.75);
      for (const s of raw.suppliers) {
        raw.services.push({
          key: `${s.key}:sahiwal:68.75`,
          animalSpecies: "CATTLE",
          breedKey: "sahiwal",
          breedName: "Sahiwal",
          breedCode: "SAH",
          geneticPercentage: 68.75,
          semenSupplier: s.key,
          serviceCategory: "ai-service",
          defaultServiceName: `Sahiwal (SAH) 68.75% - ${s.shortName} Semen AI Service`,
          isActive: true,
        });
      }
    });

    const report = await importCattleAiCatalog(db, grown, APPROVED);
    expect(report.templates).toMatchObject({ total: 120, created: 6, existing: 114 });
    expect(db.state.templates).toHaveLength(120);
    expect(db.state.templates.slice(0, 114)).toEqual(before);
  });
});

describe("transactions and dry runs", () => {
  it("rolls back everything when a template insert fails midway", async () => {
    const db = new FakeDb(seededMasters());
    db.failAfterTemplates = 40;
    await expect(importCattleAiCatalog(db, loadCatalog(), APPROVED)).rejects.toThrow("simulated database failure");
    expect(db.state.templates).toHaveLength(0);
    expect(db.state.providers).toHaveLength(4);
    expect(db.state.breeds).toHaveLength(5);

    db.failAfterTemplates = null;
    const retry = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(retry.templates.created).toBe(114);
    expect(db.state.templates).toHaveLength(114);
  });

  it("dry run reports what would happen and writes nothing", async () => {
    const db = new FakeDb(seededMasters());
    const before = structuredClone(db.state);
    const report = await importCattleAiCatalog(db, loadCatalog(), { dryRun: true, approvalStatus: "APPROVED" });
    expect(report.dryRun).toBe(true);
    expect(report.templates).toMatchObject({ created: 114, existing: 0 });
    expect(report.providers.created.sort()).toEqual(["lal-teer", "milk-vita"]);
    expect(db.state).toEqual(before);
  });

  it("dry run after a real import reports nothing to create", async () => {
    const db = new FakeDb();
    await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    const report = await importCattleAiCatalog(db, loadCatalog(), { dryRun: true, approvalStatus: "APPROVED" });
    expect(report.templates).toMatchObject({ created: 0, existing: 114 });
  });

  it("warns (but still imports) when the ai-service category is missing", async () => {
    const db = new FakeDb({ categories: [] });
    const report = await importCattleAiCatalog(db, loadCatalog(), APPROVED);
    expect(report.warnings.join(" ")).toMatch(/ServiceCategory "ai-service" not found/);
    expect(report.templates.created).toBe(114);
  });

  it("throws a typed error for an unusable remainder breed", async () => {
    const catalog = loadCatalog();
    catalog.defaults.remainderBreedSlug = "cattle-missing";
    await expect(importCattleAiCatalog(new FakeDb(), catalog, APPROVED)).rejects.toBeInstanceOf(CatalogImportError);
  });
});
