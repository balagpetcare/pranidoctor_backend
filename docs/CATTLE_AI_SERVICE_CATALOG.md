# Cattle AI Service Catalog

**সারসংক্ষেপ (বাংলা):** এআই টেকনিশিয়ানরা এখন ক্যাটালগ থেকে জাত (breed) → জেনেটিক শতাংশ → সিমেন সরবরাহকারী বেছে নিয়ে দ্রুত সার্ভিস তৈরি করতে পারবেন। সিমেনের দাম ও এআই সার্ভিস চার্জ টেকনিশিয়ান নিজে দেন; সিস্টেম মোট মূল্য হিসাব করে। ক্যাটালগে কোনো দাম নেই। ইম্পোর্ট কমান্ড বারবার চালানো নিরাপদ: কিছু মোছে না, কোনো দাম বা অ্যাডমিনের সম্পাদনা বদলায় না।

This catalog sits **on top of the existing semen template system** (`SemenProvider`, `LivestockBreed`,
`SemenServiceTemplate` + breed mix, `AiTechnicianService`, `TechnicianSemenInventory`). It does not add a parallel
architecture. Design background: `pranidoctor-web/docs/AI_TECHNICIAN_SEMEN_SERVICE_TEMPLATE_PLAN.md`.

## What a catalog row becomes

| Catalog field | Stored as |
|---|---|
| supplier | `SemenProvider` (matched by `slug`, created only if missing) |
| breed | `LivestockBreed` (matched by `slug`, created only if missing) |
| `geneticPercentage` | `SemenServiceTemplateBreedMix.percentage` (`Decimal(5,2)`) |
| `defaultServiceName` | `SemenServiceTemplate.internalName` (becomes the technician listing title) |
| `isActive` | `SemenServiceTemplate.isActive` |
| `serviceCategory`, `breedCode`, key | tags in `SemenServiceTemplate.tagsJson` |

`geneticPercentage` is the **expected genetic composition of the semen / breeding line**. It is not a market share
or production percentage.

Template breed mixes must sum to 100 (existing admin rule). For a graded line below 100% the remainder is assigned to
`defaults.remainderBreedSlug` (**`cattle-local`**, i.e. HF 75% is stored as 75 HF + 25 Local; Sahiwal 62.5% as
62.5 Sahiwal + 37.5 Local). This is an assumption — change the slug in the JSON if your veterinary team prefers a
different cross base. Pure lines (Brahman, RCC, North Bengal Grey, Pabna, Munshiganj, Jersey, Indigenous/Local) are
stored as a single 100% row; no percentages were invented for them.

## Files

| File | Purpose |
|---|---|
| `prisma/seed-data/cattle-ai-service-catalog.json` | The catalog (suppliers, breeds, 114 service rows, unsupported items). `prisma/data/` is git-ignored in this repo, so the project's existing `prisma/seed-data/` is used. |
| `prisma/seeds/cattle_ai_service_catalog.seed.ts` | Import command (CLI + Prisma adapter) |
| `src/legacy/web/lib/cattle-ai-catalog/catalog-schema.ts` | Catalog validation (zod + cross-reference checks, rejects any price field) |
| `src/legacy/web/lib/cattle-ai-catalog/import-catalog.ts` | Idempotent importer (database-agnostic, unit-tested) |
| `src/legacy/web/lib/mobile-ai-technician/ai-service-pricing.ts` | `semenPrice + aiServiceCharge = total` (exact paisa arithmetic) |
| `prisma/migrations/20260624120000_ai_service_price_split/` | Adds 2 nullable columns |

Catalog contents: 6 suppliers x 19 breed/percentage lines = 114 rows.

- **Suppliers:** BRAC, DLS, ACI Animal Genetics, Milk Vita, Lal Teer, Other / Custom Supplier.
- **Holstein Friesian (HF):** 50, 62.5, 68.75, 75, 87.5, 93.75, 100
- **Sahiwal:** 50, 62.5, 75, 87.5, 100
- **Others (100%):** Brahman, RCC, North Bengal Grey, Pabna, Munshiganj, Jersey, Indigenous / Local

Existing master rows from `prisma/seed.ts` are reused by slug and are **never renamed**: `brac`, `aci` (named "ACI"),
`dls-government`, `others`, `cattle-holstein-friesian`, `cattle-sahiwal`, `cattle-jersey`, `cattle-brahman`,
`cattle-local`. New masters: providers `milk-vita`, `lal-teer`; breeds `cattle-red-chittagong`,
`cattle-north-bengal-grey`, `cattle-pabna`, `cattle-munshiganj`.

## Not claimed / not supported

- **Supplier availability is not verified.** Every supplier x breed x percentage row is a *selectable option*, tagged
  `availability:unverified`. The catalog does not say a supplier currently sells it. Turn combinations off by setting
  `"isActive": false` in the JSON before the first import, or by deactivating the template in the admin panel
  afterwards (re-imports never re-activate it).
- **Murrah Buffalo is not imported.** `AnimalType` has no `BUFFALO` value, so a buffalo template cannot be stored or
  validated. It is listed under `unsupported` and shown in the import report. Add the animal type first, then add rows.
- **No semen prices anywhere.** Templates are created with `defaultBasePrice = 0.00` (the column is required). A
  catalog-based service cannot be saved without a technician-entered price (`PRICE_REQUIRED`).

## Import command

```bash
npm run db:seed:cattle-ai-services -- --dry-run     # report only, writes nothing
npm run db:seed:cattle-ai-services                  # import
```

| Flag | Meaning |
|---|---|
| `--dry-run` | Report what would be created; no writes |
| `--approval-status=DRAFT\|PENDING_REVIEW\|APPROVED` | Status of **newly created** templates. Default `APPROVED` (technicians can use them immediately; the templates carry only names and composition, no medical claims). Use `DRAFT` if the veterinary owner wants to review in the admin panel first. |
| `--file=<path>` | Alternative catalog file |
| `--json` | Machine-readable report |

Guarantees:

- **Validates first.** Schema, cross-references, allowed percentages per breed, duplicate keys, forbidden price keys.
  Invalid file → exit code 1, nothing written.
- **Create-only.** Existing providers, breeds and templates are never updated, re-activated, re-priced or re-approved,
  and nothing is deleted. Technician services, prices, offers and stock lots are never touched.
- **Duplicate-safe.** A template is recognised by its `catalog-key:<supplier>:<breed>:<pct>` tag, or (fallback, if an
  admin removed the tags) by supplier + exact name. A `pg_advisory_xact_lock` serialises concurrent runs.
- **One transaction.** Any failure rolls back the whole import (re-run is safe).
- **Report.** Created / existing counts per entity, new master slugs, unsupported items, warnings (for example a
  missing `ai-service` category — run `npm run db:seed` first).

## Technician workflow (backend API)

All endpoints already existed and sit behind `requireMobileAiTechnicianModuleUser`; only **APPROVED / PUBLISHED**
technicians may create or edit services (others get `NOT_ALLOWED`). A technician can only see and edit their own
services.

1. **Browse** — `GET /api/mobile/ai-technician/semen-templates?animalType=CATTLE&breedId=…&providerId=…&limit=50&offset=0`.
   Returns approved + active templates with `semenProvider` and `breedMix`. A client builds the pickers
   *breed → genetic percentage → supplier* from `breedMix`: the row whose `breedId` is the chosen breed carries the
   genetic percentage (the other row, if any, is the local remainder). Do not rely on row order.
2. **Create** — `POST /api/mobile/ai-technician/services/from-template`

   ```json
   { "templateId": "…", "semenPrice": 500, "aiServiceCharge": 300, "isAvailable": true }
   ```

   Saved as `basePrice = 800.00`, `semenPrice = 500.00`, `aiServiceCharge = 300.00`, status `DRAFT` (existing
   admin-approval flow). The example is a test value, not a market price.
3. **Edit / activate** — `PATCH /api/mobile/ai-technician/services/:id` with `semenPrice`, `aiServiceCharge`,
   `isAvailable`, `offerPrice` **or** `discountPercent`, notes. Changing one half of the split re-derives the total from
   the stored other half.
4. **Custom combinations** — `POST /api/mobile/ai-technician/services` (existing manual service; now also accepts
   `semenPrice` + `aiServiceCharge`) for a supplier/breed not in the catalog, for example the "Other / Custom Supplier"
   case.

Responses now include `semenPrice`, `aiServiceCharge` and `totalCustomerPrice` (= `basePrice`, before offer/discount).

Pricing rules (422 with these codes): `PRICE_INCOMPLETE` (only one half given), `PRICE_MISMATCH` (explicit `basePrice`
≠ sum), `INVALID_PRICE` (negative / more than 2 decimals), `PRICE_REQUIRED` (no price for a zero-default template).
`basePrice` stays the customer price for every existing reader (farmer listing, booking estimate). A request that sends
only `basePrice` keeps working and clears the split so the two can never disagree.

## Deploying

```bash
# 1. back up the production database, then:
ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy   # adds 2 nullable columns, no data change
npm run db:generate
# 2. in pranidoctor-web: npm run db:client:sync (mirrors the generated client)
# 3. import
npm run db:seed:cattle-ai-services -- --dry-run
npm run db:seed:cattle-ai-services
```

Rollback: deactivate templates in the admin panel (or re-import nothing). The migration is additive; do not drop the
columns once technicians have entered prices.

## Tests

```bash
npx vitest run src/legacy/web/lib/cattle-ai-catalog src/legacy/web/lib/mobile-ai-technician
```

- `catalog-schema.test.ts` — the real JSON file (percentages, 114 rows, suppliers, no prices, Murrah unsupported) and rejections.
- `import-catalog.test.ts` — in-memory database with rollback: first import, exact percentages, breed mix = 100, supplier links, reuse of seeded masters without renaming, repeated runs, preservation of admin edits, rename/tag-loss handling, growth, rollback on failure, dry run.
- `ai-service-pricing.test.ts`, `technician-pricing-flow.test.ts` — 500 + 300 = 800, mismatch/incomplete/required rules, legacy single price, custom services, technician permissions (every non-approved status), ownership, activate/deactivate.

The importer's Prisma adapter and the migration are verified by type-check and review only; run the dry run against a
staging database before production (see Deploying).
