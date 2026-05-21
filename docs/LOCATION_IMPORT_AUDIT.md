# Location import audit

Generated: 2026-05-22

## Schema (pranidoctor-backend)

Normalized hierarchy in `prisma/schema.prisma`:

| Model | Parent FK | onDelete |
|-------|-----------|----------|
| `Division` | — | — |
| `District` | `divisionId` | Restrict |
| `Upazila` | `districtId` | Restrict |
| `Union` | `upazilaId` | Restrict |
| `Village` | `unionId` | Restrict |

Parallel legacy `Area` tree (self-referential) remains for older flows; **not** populated by the new location seed.

Unique indexes: partial unique on `TRIM(code)` per parent (`20260511133000_location_dedupe_unique_constraints`).

## Authoritative sheet source (single source of truth)

| File | Rows (approx.) | Role |
|------|----------------|------|
| `pranidoctor-web/data/locations/divisions.csv` | 8 | Division master |
| `pranidoctor-web/data/locations/districts.csv` | 64 | District master |
| `pranidoctor-web/data/locations/upazilas.csv` | 494 | Upazila master |
| `pranidoctor-web/data/locations/unions.csv` | 4540 | Union master |
| `pranidoctor-web/data/locations/villages.csv` | 0 (header only) | Village master (pending official data) |

Registry: `data/locations/source-registry.json`  
Upstream: nuhil/bangladesh-geocode (see `SOURCE_COLLECTION_GUIDE.md`).

Override data path: `LOCATION_DATA_DIR` (defaults to sibling `../pranidoctor-web/data/locations`).

## Removed / deprecated hardcoded geo

| Path | Status |
|------|--------|
| `prisma/seed.ts` inline Dhaka/Gazipur `Division`→`Village` demo | **Removed** |
| `prisma/seed.ts` legacy `Area` demo tree | **Removed** |
| `prisma/seed-data/bd-locations.ts` | **Deprecated** (not called by seed) |
| `scripts/area-seed-lib.ts` `AREA_ENGINE_VILLAGE_ROWS` | **Removed** |
| `applyAreaEngineSeed()` | **Version stamp only** after sheet import |

## New backend tooling

| Script | npm command | Purpose |
|--------|-------------|---------|
| `scripts/reset-location-data.ts` | `npm run location:reset` | Transactional clear (child → parent) |
| `scripts/import-location-sheet.ts` | `npm run seed:location` | Idempotent CSV import |
| `prisma/seed-location.ts` | `seed:reset-location` / `seed:full-location` | Reset-only / reset+import+verify |

## Web tooling (unchanged; reference)

- `pranidoctor-web/scripts/import-locations.ts` — prior CSV importer
- `pranidoctor-web/scripts/locations/clear-location-master-for-nuhil-rebuild.ts`
- Admin: `src/app/admin/(dashboard)/locations/*`

## Safe delete order

1. Nullify `ServiceRequest.villageId`, `CustomerProfile.primaryVillageId`, AI tech geo FKs  
2. `DELETE Village` (cascades doctor/AI service area junctions)  
3. `DELETE Union` → `Upazila` → `District` → `Division`

## Main seed integration

Set `PRANI_SEED_LOCATION`:

- `full` — reset + import + verify + area-engine version stamp  
- `import` / `true` — import only (idempotent)  
- unset — skip location (use `npm run seed:full-location` explicitly)
