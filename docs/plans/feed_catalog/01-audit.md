# Feed Catalog Master — Step 1 Audit

**Task:** `BANGLADESH_FEED_MASTER_CATALOG_SEED_V1`  
**Date:** 2026-05-24  
**Scope:** `pranidoctor-backend`, `pranidoctor-web`, `pranidoctor_user`

---

## Executive summary

Farm feed today is **per-farmer stock** (`InventoryItem`) plus **consumption logs** (`FeedRecord`) keyed by the legacy `FeedType` enum. There is **no** platform-level feed master. Adding **`FeedCategory` (enum) + `FeedCatalog` (table)** as new master data **without altering** `InventoryItem` columns is **SAFE**. Optional nullable `feedCatalogId` on `InventoryItem` is **WARNING** (additive, non-breaking). Replacing `FeedType` or removing custom `CREATE_ITEM` is **BLOCKER**.

---

## 1. Prisma schema

| Artifact | Status | Notes |
|----------|--------|-------|
| `FeedCatalog` / `FeedCategory` | **Missing** | Greenfield |
| `FeedType` enum | **Exists** | `GRASS`, `STRAW`, `CONCENTRATE`, `MINERAL`, `SILAGE`, `OTHER` |
| `FeedRecord` | **Exists** | Optional `inventoryItemId`, `deductStock` |
| `InventoryItem` | **Exists** | Comment: “Farm inventory catalog”; unique `(customerId, farmRef, inventoryType, displayName)` |
| `BatchFeedPlan` | **Exists** | Optional `feedType` for fattening |
| `Ration` model | **Missing** | N/A |

**Verdict:** **WARNING** — `InventoryItem` naming overlaps “catalog”; new master must stay clearly separate.

---

## 2. Inventory modules

| Path | Role |
|------|------|
| `src/modules/inventory/inventory.service.ts` | `CREATE_ITEM`, stock ops, `consumeForFeedRecord` |
| `src/modules/inventory/inventory.repository.ts` | Prisma CRUD |
| `src/modules/inventory/inventory.schemas.ts` | Zod validation |
| `src/modules/inventory/feed/feed-inventory.service.ts` | FEED list wrapper |

**Verdict:** **SAFE** — no changes required until optional `feedCatalogId` on create.

---

## 3. Animal modules

`src/modules/animals/` — animal CRUD only; no feed endpoints.

**Verdict:** **SAFE**

---

## 4. Seed infrastructure

| Script | Entry |
|--------|--------|
| `db:seed` | `prisma/seed.ts` |
| `db:seed:admin` | `prisma/seed-admin.ts` |
| `seed:user-app` | `scripts/seed/user_app_seed.ts` |

Pattern: idempotent `upsert` by slug/code (`LivestockBreed`, `SemenProvider`, `ContentCategory`). **No** feed/inventory seeds today.

**Verdict:** **WARNING** — new `prisma/seeds/feed_catalog.seed.ts` follows existing upsert pattern.

---

## 5. Existing category tables

| Name | Feed-related? |
|------|----------------|
| `ContentCategory` | Tutorial taxonomy only (`khadyo-byabosthapona` = feed *management* articles) |
| `ServiceCategory` | Clinical services |
| `ExpenseCategory.FEED` | Finance bucket |
| `FeedType` enum | De facto category on logs + inventory |

**Verdict:** **WARNING** — document `FeedCategory` enum as **product master**, not Knowledge Hub category.

---

## 6. Migration history

| Migration | Impact |
|-----------|--------|
| `20260522140000_phase4_feed_records` | `FeedRecord` |
| `20260523160000_phase3_batch_feeding` | `BatchFeedPlan` |
| `20260524120000_farm_inventory_v1` | Full inventory stack |

**Verdict:** **SAFE** — additive migration for new tables + nullable FK is consistent.

---

## 7. API routes

### Farmer (mobile)

- `GET/POST` `/api/mobile/feeds`
- `GET` `/api/mobile/inventory/feed`
- `POST` `/api/mobile/inventory/add` (`CREATE_ITEM`)

### Admin

- No feed/inventory routes today
- Masters: `livestock-breeds`, `content-categories`, `semen-providers`

**Verdict:** **WARNING** — new `/api/admin/feed-catalog` and `/api/mobile/feed-catalog` required.

---

## 8. Web admin (`pranidoctor-web`)

No admin feed pages or API clients. Mobile proxies only under `src/app/api/mobile/feeds/**`, `inventory/**`.

**Verdict:** **BLOCKER** for admin UI until backend admin API exists (resolved in implementation).

---

## 9. Mobile app (`pranidoctor_user`)

- **Consumption:** `/feeds` → `FeedEntryFormPage` (enum `FeedType`, optional stock deduct)
- **Stock catalog:** `/inventory/feed/create` → free-text name + enum
- Catalog picker only when **deducting stock**, not when adding stock

**Verdict:** **SAFE** to add master picker on stock create; **WARNING** for `FeedType` mapping from `FeedCategory`.

---

## Classification matrix

| Area | Verdict | Rationale |
|------|---------|-----------|
| New `FeedCatalog` table only | **SAFE** | No existing table conflict |
| New `FeedCategory` enum | **SAFE** | Fixed taxonomy |
| Nullable `InventoryItem.feedCatalogId` | **WARNING** | Additive FK; audit approved in 02-db-design |
| Change `InventoryItem` uniqueness / drop `displayName` | **BLOCKER** | Breaks farms + APIs |
| Replace `FeedType` enum | **BLOCKER** | Breaks `FeedRecord`, analytics, mobile |
| Remove custom `CREATE_ITEM` | **BLOCKER** | Product requirement |
| Point `FeedRecord` at `FeedCatalog` without inventory | **BLOCKER** | Breaks stock deduct |

---

## Recommended integration shape

```
FeedCategory (enum) + FeedCatalog (global master)
        ↓ optional pick
InventoryItem (per-farm stock; feedCatalogId?)
        ↓ optional deduct
FeedRecord (consumption; FeedType enum unchanged)
```

---

## References

- `prisma/schema.prisma` — `FeedRecord`, `InventoryItem` (~2056–2151)
- `docs/plans/FIX_MOBILE_FEEDS_LEGACY_INVENTORY_IMPORT_AND_RESTORE_BACKWARD_COMPAT_V1.md`
- `pranidoctor_user/docs/plans/farm_inventory/03-conflict-analysis.md` (C-04 FeedType vs catalog)
