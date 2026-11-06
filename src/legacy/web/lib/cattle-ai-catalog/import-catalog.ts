/**
 * Idempotent importer for the cattle AI service catalog.
 *
 * Rules (see docs/CATTLE_AI_SERVICE_CATALOG.md):
 *  - Create-only: existing providers, breeds and templates are never updated, re-activated,
 *    re-priced or re-approved, so admin edits and technician pricing survive every re-run.
 *  - Nothing is ever deleted.
 *  - One transaction: either the whole catalog is imported or nothing is.
 *  - No prices: templates are created with defaultBasePrice 0.00 (technicians set real prices).
 *
 * This module only talks to the database through `CatalogDb`, so it can be unit-tested with an
 * in-memory fake. The Prisma adapter lives in prisma/seeds/cattle_ai_service_catalog.seed.ts.
 */
import {
  formatPercentage,
  toHundredths,
  type CatalogBreed,
  type CatalogService,
  type CatalogSupplier,
  type CattleAiCatalog,
} from "./catalog-schema.js";

export type ImportApprovalStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED";

export type ImportOptions = {
  dryRun: boolean;
  approvalStatus: ImportApprovalStatus;
  now?: () => Date;
};

export type NewTemplateData = {
  internalName: string;
  animalType: "CATTLE";
  semenProviderId: string;
  semenProductKind: string;
  shortDescription: string;
  /** Always "0.00": the catalog never carries a price. */
  defaultBasePrice: string;
  tags: string[];
  isActive: boolean;
  approvalStatus: ImportApprovalStatus;
  approvedAt: Date | null;
  breedMix: { breedId: string; percentage: string }[];
};

export type ExistingTemplateRow = {
  id: string;
  internalName: string;
  semenProviderId: string;
  tags: string[];
};

export interface CatalogTx {
  /** Serialises concurrent imports (pg_advisory_xact_lock). */
  acquireImportLock(): Promise<void>;
  findProviderBySlug(slug: string): Promise<{ id: string } | null>;
  createProvider(data: {
    slug: string;
    name: string;
    nameBn: string;
    sortOrder: number;
  }): Promise<{ id: string }>;
  findBreedBySlug(slug: string): Promise<{ id: string; animalType: string } | null>;
  createBreed(data: {
    slug: string;
    nameEn: string;
    nameBn: string;
    animalType: "CATTLE";
  }): Promise<{ id: string }>;
  listCattleTemplatesForProviders(providerIds: string[]): Promise<ExistingTemplateRow[]>;
  createTemplate(data: NewTemplateData): Promise<{ id: string }>;
  serviceCategoryExists(slug: string): Promise<boolean>;
}

export interface CatalogDb {
  transaction<T>(fn: (tx: CatalogTx) => Promise<T>): Promise<T>;
}

export type ImportReport = {
  catalogId: string;
  dryRun: boolean;
  approvalStatus: ImportApprovalStatus;
  providers: { created: string[]; existing: string[] };
  breeds: { created: string[]; existing: string[] };
  templates: {
    total: number;
    created: number;
    existing: number;
    createdInactive: number;
    createdKeys: string[];
  };
  unsupported: { name: string; reason: string }[];
  warnings: string[];
};

export class CatalogImportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CatalogImportError";
  }
}

export const CATALOG_TAG = "cattle-ai-catalog";

export function catalogKeyTag(key: string): string {
  return `catalog-key:${key}`;
}

/** Breed composition for a catalog line; the remainder goes to the configured local breed. */
export function buildBreedMix(
  breed: CatalogBreed,
  percentage: number,
  remainderBreed: CatalogBreed,
): { breedKey: string; percentage: number }[] {
  if (percentage === 100) return [{ breedKey: breed.key, percentage: 100 }];
  const rest = (10_000 - toHundredths(percentage)) / 100;
  return [
    { breedKey: breed.key, percentage },
    { breedKey: remainderBreed.key, percentage: rest },
  ];
}

function compositionLabel(mix: { breedKey: string; percentage: number }[], breeds: Map<string, CatalogBreed>) {
  return mix
    .map((m) => `${formatPercentage(m.percentage)}% ${breeds.get(m.breedKey)!.nameEn}`)
    .join(" + ");
}

function buildTags(row: CatalogService, supplier: CatalogSupplier): string[] {
  return [
    CATALOG_TAG,
    catalogKeyTag(row.key),
    `breed-code:${row.breedCode}`,
    `genetic-percent:${formatPercentage(row.geneticPercentage)}`,
    `supplier:${supplier.key}`,
    `service-category:${row.serviceCategory}`,
    // The catalog does not assert that a supplier sells this combination.
    "availability:unverified",
  ];
}

export async function importCattleAiCatalog(
  db: CatalogDb,
  catalog: CattleAiCatalog,
  options: ImportOptions,
): Promise<ImportReport> {
  const now = options.now ?? (() => new Date());
  const breedsByKey = new Map(catalog.breeds.map((b) => [b.key, b]));
  const suppliersByKey = new Map(catalog.suppliers.map((s) => [s.key, s]));
  const remainderBreed = catalog.breeds.find((b) => b.slug === catalog.defaults.remainderBreedSlug);
  if (!remainderBreed) {
    throw new CatalogImportError("REMAINDER_BREED_MISSING", "remainderBreedSlug is not a catalog breed");
  }

  // Build and verify every template plan before touching the database.
  const plans = catalog.services.map((row) => {
    const breed = breedsByKey.get(row.breedKey);
    const supplier = suppliersByKey.get(row.semenSupplier);
    if (!breed || !supplier) {
      throw new CatalogImportError("UNKNOWN_REFERENCE", `service ${row.key}: unknown breed or supplier`);
    }
    const mix = buildBreedMix(breed, row.geneticPercentage, remainderBreed);
    const sum = mix.reduce((acc, m) => acc + toHundredths(m.percentage), 0);
    if (sum !== 10_000) {
      throw new CatalogImportError("BREED_MIX_SUM", `service ${row.key}: breed mix sums to ${sum / 100}, expected 100`);
    }
    return { row, breed, supplier, mix };
  });

  const report: ImportReport = {
    catalogId: catalog.catalog.id,
    dryRun: options.dryRun,
    approvalStatus: options.approvalStatus,
    providers: { created: [], existing: [] },
    breeds: { created: [], existing: [] },
    templates: { total: plans.length, created: 0, existing: 0, createdInactive: 0, createdKeys: [] },
    unsupported: catalog.unsupported.map((u) => ({ name: u.name, reason: u.reason })),
    warnings: [],
  };

  await db.transaction(async (tx) => {
    await tx.acquireImportLock();

    const providerIds = new Map<string, string>();
    for (const s of catalog.suppliers) {
      const found = await tx.findProviderBySlug(s.slug);
      if (found) {
        providerIds.set(s.key, found.id);
        report.providers.existing.push(s.slug);
      } else if (options.dryRun) {
        providerIds.set(s.key, `dry-run:provider:${s.slug}`);
        report.providers.created.push(s.slug);
      } else {
        const created = await tx.createProvider({
          slug: s.slug,
          name: s.name,
          nameBn: s.nameBn,
          sortOrder: s.sortOrder,
        });
        providerIds.set(s.key, created.id);
        report.providers.created.push(s.slug);
      }
    }

    const breedIds = new Map<string, string>();
    for (const b of catalog.breeds) {
      const found = await tx.findBreedBySlug(b.slug);
      if (found) {
        if (found.animalType !== "CATTLE") {
          throw new CatalogImportError(
            "BREED_ANIMAL_TYPE_MISMATCH",
            `breed "${b.slug}" already exists with animalType ${found.animalType}, expected CATTLE`,
          );
        }
        breedIds.set(b.key, found.id);
        report.breeds.existing.push(b.slug);
      } else if (options.dryRun) {
        breedIds.set(b.key, `dry-run:breed:${b.slug}`);
        report.breeds.created.push(b.slug);
      } else {
        const created = await tx.createBreed({
          slug: b.slug,
          nameEn: b.nameEn,
          nameBn: b.nameBn,
          animalType: "CATTLE",
        });
        breedIds.set(b.key, created.id);
        report.breeds.created.push(b.slug);
      }
    }

    if (!(await tx.serviceCategoryExists(catalog.defaults.serviceCategory))) {
      report.warnings.push(
        `ServiceCategory "${catalog.defaults.serviceCategory}" not found; run npm run db:seed first. ` +
          "Templates are still imported (the category is stored as a tag only).",
      );
    }

    const realProviderIds = [...providerIds.values()].filter((id) => !id.startsWith("dry-run:"));
    const existingRows = realProviderIds.length
      ? await tx.listCattleTemplatesForProviders(realProviderIds)
      : [];
    const byKey = new Map<string, ExistingTemplateRow>();
    const byName = new Map<string, ExistingTemplateRow>();
    for (const r of existingRows) {
      for (const t of r.tags) {
        if (t.startsWith("catalog-key:")) byKey.set(t.slice("catalog-key:".length), r);
      }
      byName.set(`${r.semenProviderId}|${r.internalName}`, r);
    }

    for (const { row, supplier, mix } of plans) {
      const providerId = providerIds.get(supplier.key)!;
      const hit = byKey.get(row.key) ?? byName.get(`${providerId}|${row.defaultServiceName}`);
      if (hit) {
        report.templates.existing += 1;
        continue;
      }

      report.templates.created += 1;
      if (!row.isActive) report.templates.createdInactive += 1;
      report.templates.createdKeys.push(row.key);
      if (options.dryRun) continue;

      const approved = options.approvalStatus === "APPROVED";
      await tx.createTemplate({
        internalName: row.defaultServiceName,
        animalType: "CATTLE",
        semenProviderId: providerId,
        semenProductKind: catalog.defaults.semenProductKind,
        shortDescription:
          `Genetic composition: ${compositionLabel(mix, breedsByKey)}. Supplier: ${supplier.shortName}.`,
        defaultBasePrice: "0.00",
        tags: buildTags(row, supplier),
        isActive: row.isActive,
        approvalStatus: options.approvalStatus,
        approvedAt: approved ? now() : null,
        breedMix: mix.map((m) => ({
          breedId: breedIds.get(m.breedKey)!,
          percentage: m.percentage.toFixed(2),
        })),
      });
    }
  });

  return report;
}

export function formatImportReport(r: ImportReport): string {
  const lines = [
    `Cattle AI service catalog import${r.dryRun ? " (DRY RUN — nothing written)" : ""}`,
    `  catalog          : ${r.catalogId}`,
    `  approval status  : ${r.approvalStatus} (applies to newly created templates only)`,
    `  providers        : ${r.providers.created.length} created, ${r.providers.existing.length} existing`,
    `  breeds           : ${r.breeds.created.length} created, ${r.breeds.existing.length} existing`,
    `  templates        : ${r.templates.created} created, ${r.templates.existing} already present, ${r.templates.total} in catalog`,
  ];
  if (r.providers.created.length) lines.push(`  new providers    : ${r.providers.created.join(", ")}`);
  if (r.breeds.created.length) lines.push(`  new breeds       : ${r.breeds.created.join(", ")}`);
  if (r.templates.createdInactive) {
    lines.push(`  created inactive : ${r.templates.createdInactive}`);
  }
  for (const u of r.unsupported) lines.push(`  UNSUPPORTED      : ${u.name} — ${u.reason}`);
  for (const w of r.warnings) lines.push(`  WARNING          : ${w}`);
  return lines.join("\n");
}

