/**
 * Cattle AI service catalog — file format + validation (pure module, no database access).
 * Source file: prisma/seed-data/cattle-ai-service-catalog.json
 */
import { z } from "zod";

export const CATALOG_SCHEMA_VERSION = 1;

/** Keys that must never appear in the catalog: semen / service prices are technician-controlled. */
const FORBIDDEN_PRICE_KEYS = [
  "price",
  "basePrice",
  "semenPrice",
  "aiServiceCharge",
  "serviceCharge",
  "offerPrice",
  "discountPercent",
  "defaultBasePrice",
  "defaultOfferPrice",
  "cost",
  "fee",
];

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and hyphens only");

const key = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and hyphens only");

/** Percentage with at most 2 decimals (matches Decimal(5,2) in the database). */
const percentage = z
  .number()
  .gt(0)
  .lte(100)
  .refine((v) => Math.round(v * 100) / 100 === v, "at most 2 decimal places");

const supplierSchema = z
  .object({
    key,
    slug,
    name: z.string().trim().min(1).max(160),
    shortName: z.string().trim().min(1).max(80),
    nameBn: z.string().trim().min(1).max(160),
    sortOrder: z.number().int().min(0).max(10_000),
    isCustom: z.boolean(),
  })
  .strict();

const breedSchema = z
  .object({
    key,
    code: z
      .string()
      .trim()
      .min(2)
      .max(12)
      .regex(/^[A-Z0-9]+$/, "uppercase letters and digits only"),
    slug,
    nameEn: z.string().trim().min(1).max(160),
    nameBn: z.string().trim().min(1).max(160),
    kind: z.enum(["GRADED", "PURE"]),
    geneticPercentages: z.array(percentage).min(1).max(20),
  })
  .strict();

const unsupportedSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().min(1),
    animalSpecies: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict();

const serviceSchema = z
  .object({
    key: z.string().trim().min(3).max(200),
    animalSpecies: z.literal("CATTLE"),
    breedKey: key,
    breedName: z.string().trim().min(1),
    breedCode: z.string().trim().min(2),
    geneticPercentage: percentage,
    semenSupplier: key,
    serviceCategory: slug,
    defaultServiceName: z.string().trim().min(3).max(200),
    isActive: z.boolean(),
  })
  .strict();

const catalogSchema = z
  .object({
    schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
    catalog: z
      .object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        notes: z.array(z.string()).optional(),
      })
      .strict(),
    defaults: z
      .object({
        serviceCategory: slug,
        semenProductKind: z.enum(["NORMAL", "SEXED", "PREMIUM", "IMPORTED", "LOCAL"]),
        remainderBreedSlug: slug,
      })
      .strict(),
    suppliers: z.array(supplierSchema).min(1),
    breeds: z.array(breedSchema).min(1),
    unsupported: z.array(unsupportedSchema).default([]),
    services: z.array(serviceSchema).min(1),
  })
  .strict();

export type CatalogSupplier = z.infer<typeof supplierSchema>;
export type CatalogBreed = z.infer<typeof breedSchema>;
export type CatalogService = z.infer<typeof serviceSchema>;
export type CatalogUnsupported = z.infer<typeof unsupportedSchema>;
export type CattleAiCatalog = z.infer<typeof catalogSchema>;

export type CatalogValidationResult =
  | { ok: true; catalog: CattleAiCatalog }
  | { ok: false; errors: string[] };

/** Canonical formatting used in keys and names: 62.5 -> "62.5", 75 -> "75". */
export function formatPercentage(p: number): string {
  return String(p);
}

/** Percentage as integer hundredths (62.5 -> 6250) so sums are exact. */
export function toHundredths(p: number): number {
  return Math.round(p * 100);
}

export function buildServiceKey(supplierKey: string, breedKey: string, p: number): string {
  return `${supplierKey}:${breedKey}:${formatPercentage(p)}`;
}

function findForbiddenPriceKeys(node: unknown, path: string, out: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findForbiddenPriceKeys(item, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (FORBIDDEN_PRICE_KEYS.includes(k)) {
        out.push(`${path}.${k}: prices must not be stored in the catalog (technicians set prices)`);
      }
      findForbiddenPriceKeys(v, `${path}.${k}`, out);
    }
  }
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

export function validateCatalog(raw: unknown): CatalogValidationResult {
  const errors: string[] = [];

  findForbiddenPriceKeys(raw, "$", errors);
  if (errors.length > 0) return { ok: false, errors };

  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `$.${i.path.join(".")}: ${i.message}`),
    };
  }
  const c = parsed.data;

  for (const d of duplicates(c.suppliers.map((s) => s.key))) errors.push(`duplicate supplier key "${d}"`);
  for (const d of duplicates(c.suppliers.map((s) => s.slug))) errors.push(`duplicate supplier slug "${d}"`);
  for (const d of duplicates(c.breeds.map((b) => b.key))) errors.push(`duplicate breed key "${d}"`);
  for (const d of duplicates(c.breeds.map((b) => b.slug))) errors.push(`duplicate breed slug "${d}"`);
  for (const d of duplicates(c.breeds.map((b) => b.code))) errors.push(`duplicate breed code "${d}"`);
  for (const d of duplicates(c.services.map((s) => s.key))) errors.push(`duplicate service key "${d}"`);

  const suppliers = new Map(c.suppliers.map((s) => [s.key, s]));
  const breeds = new Map(c.breeds.map((b) => [b.key, b]));

  if (!c.breeds.some((b) => b.slug === c.defaults.remainderBreedSlug)) {
    errors.push(
      `defaults.remainderBreedSlug "${c.defaults.remainderBreedSlug}" is not one of the catalog breeds`,
    );
  }

  for (const b of c.breeds) {
    for (const d of duplicates(b.geneticPercentages.map(String))) {
      errors.push(`breed "${b.key}": duplicate genetic percentage ${d}`);
    }
    if (b.kind === "PURE" && !(b.geneticPercentages.length === 1 && b.geneticPercentages[0] === 100)) {
      errors.push(`breed "${b.key}": a PURE breed may only have the 100% line`);
    }
    if (b.kind === "GRADED" && !b.geneticPercentages.some((p) => p === 100)) {
      errors.push(`breed "${b.key}": a GRADED breed must include its 100% line`);
    }
  }

  c.services.forEach((s, i) => {
    const at = `services[${i}] (${s.key})`;
    const supplier = suppliers.get(s.semenSupplier);
    const breed = breeds.get(s.breedKey);
    if (!supplier) errors.push(`${at}: unknown semenSupplier "${s.semenSupplier}"`);
    if (!breed) errors.push(`${at}: unknown breedKey "${s.breedKey}"`);
    if (s.serviceCategory !== c.defaults.serviceCategory) {
      errors.push(`${at}: serviceCategory "${s.serviceCategory}" differs from defaults.serviceCategory`);
    }
    if (breed) {
      if (s.breedName !== breed.nameEn) errors.push(`${at}: breedName does not match breed "${breed.key}"`);
      if (s.breedCode !== breed.code) errors.push(`${at}: breedCode does not match breed "${breed.key}"`);
      if (!breed.geneticPercentages.includes(s.geneticPercentage)) {
        errors.push(
          `${at}: geneticPercentage ${s.geneticPercentage} is not offered for breed "${breed.key}"`,
        );
      }
    }
    if (supplier && breed) {
      const expected = buildServiceKey(supplier.key, breed.key, s.geneticPercentage);
      if (s.key !== expected) errors.push(`${at}: key should be "${expected}"`);
    }
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, catalog: c };
}
