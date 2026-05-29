# Feed Catalog Master — Step 2 DB Design

**Task:** `BANGLADESH_FEED_MASTER_CATALOG_SEED_V1`

---

## Domain boundary

| Layer | Table / enum | Scope | Farmer stock? |
|-------|----------------|-------|----------------|
| Master category | `FeedCategory` enum | Platform | No |
| Master SKU | `FeedCatalog` | Platform | No |
| Farm stock | `InventoryItem` | Per customer + farm | Yes |
| Consumption | `FeedRecord` | Per customer | No (log only) |

**Rule:** Never store farmer on-hand quantity on `FeedCatalog`. Stock stays on `InventoryItem` + `InventoryBalance`.

---

## FeedCategory (enum)

Prisma enum `FeedCategory` — fixed taxonomy:

| Value | Use |
|-------|-----|
| `ROUGHAGE` | Dry fodder (straw, hay) |
| `GREEN` | Green/forage |
| `CONCENTRATE` | Grains, bran, oilcake, commercial feed |
| `SUPPLEMENT` | Molasses, additives |
| `MINERAL` | Mineral mix, salt blocks |
| `SILAGE` | Ensiled feeds |
| `CUSTOM` | Admin-defined non-seeded entries |

Not a separate table — avoids confusion with `ContentCategory` / `ServiceCategory`.

---

## FeedCatalog (model)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `cuid` | PK |
| `code` | `String @unique` | Stable seed key, e.g. `bd-rice-straw` |
| `nameBn` | `String` | Bengali display |
| `nameEn` | `String` | English display |
| `category` | `FeedCategory` | Master category |
| `defaultUnit` | `FeedUnit` | Default unit for UI |
| `approxPriceBdt` | `Decimal(12,2)?` | Reference price; admin-editable |
| `nutritionJson` | `Json?` | Optional CP, TDN, etc. |
| `availabilityScore` | `Int?` | 1–5 optional regional score |
| `isSeeded` | `Boolean` | `true` for Bangladesh seed rows |
| `isActive` | `Boolean` | Soft archive (`false` = disabled) |
| `sortOrder` | `Int` | List ordering |
| `createdAt` / `updatedAt` | `DateTime` | Audit |

**Indexes:** `(category, isActive)`, `(isActive, sortOrder)`, unique `code`.

---

## InventoryItem extension (Phase 1b — audited)

```prisma
feedCatalogId String?
feedCatalog   FeedCatalog? @relation(...)
```

- **Nullable** — existing rows unchanged.
- **Custom feeds:** `feedCatalogId = null`, free-text `displayName`.
- **From master:** set `feedCatalogId` + `displayName` copied from catalog at create time (master row never updated by farmer).
- **ON DELETE SET NULL** — disabling/archiving catalog does not delete farm stock.

**No change** to `@@unique([customerId, farmRef, inventoryType, displayName])`.

---

## FeedType mapping (application layer)

Legacy `FeedType` on `FeedRecord` / `InventoryItem` **unchanged**. Map `FeedCategory` → `FeedType` when creating farm items:

| FeedCategory | FeedType |
|--------------|----------|
| ROUGHAGE | STRAW |
| GREEN | GRASS |
| CONCENTRATE | CONCENTRATE |
| SUPPLEMENT | OTHER |
| MINERAL | MINERAL |
| SILAGE | SILAGE |
| CUSTOM | OTHER |

---

## Admin operations

| Action | Supported |
|--------|-----------|
| List / search | Yes |
| Create | Yes (`CUSTOM` or new codes) |
| Patch price, names, sort, active | Yes |
| Delete | **No** — `isActive = false` only |

---

## Seed rules

- Upsert by `code`
- On **create:** set all fields including `approxPriceBdt`
- On **update:** refresh `nameBn`, `nameEn`, `category`, `defaultUnit`, `sortOrder`, `isSeeded`; **preserve** existing `approxPriceBdt` if already set (admin override)
- Env: `FEED_CATALOG_PRICE_MULTIPLIER` (optional, default `1`) applied only on create
- Script: `prisma/seeds/feed_catalog.seed.ts`, npm `db:seed:feed-catalog`

---

## Migration

`20260524180000_feed_catalog_master_v1` — creates enum + table + nullable FK only.

---

## Out of scope (future)

- `FeedRecord.feedCatalogId` direct link
- Nutrition-driven ration engine
- Replacing `FeedType` enum
