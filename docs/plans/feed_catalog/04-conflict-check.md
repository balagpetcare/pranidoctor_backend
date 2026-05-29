# Feed Catalog — Pre-Migration Conflict Check

**Migration:** `20260524180000_feed_catalog_master_v1`  
**Date:** 2026-05-24

---

## Breaking migrations

| Check | Result |
|-------|--------|
| Drops existing tables | **No** |
| Alters `InventoryItem` required columns | **No** — nullable `feedCatalogId` only |
| Changes unique constraints on inventory | **No** |
| Renames `FeedType` / `FeedRecord` | **No** |
| NOT NULL without default on existing rows | **No** |

**Verdict:** **No breaking migrations**

---

## Inventory conflict

| Risk | Assessment |
|------|------------|
| Replaces per-farm `InventoryItem` | **No** — master is separate table |
| Changes stock ledger | **No** |
| Changes `CREATE_ITEM` for medicine | **No** — feedCatalogId only used when `inventoryType === FEED` |
| Unique `(customerId, farmRef, inventoryType, displayName)` | **Unchanged** — farmer still needs distinct display names per farm |
| Negative stock / balance logic | **Unchanged** |

**Verdict:** **No inventory conflict** (additive FK only)

---

## Treatment conflict

| System | Overlap |
|--------|---------|
| `FarmTreatment` | None — medicine JSON only |
| `Prescription` / `PrescriptionItem` | None |
| `TreatmentCase` | None |
| Medicine `InventoryItem` | Unaffected — `feedCatalogId` stays null |

**Verdict:** **No treatment conflict**

---

## Ration / batch feeding conflict

| System | Overlap |
|--------|---------|
| `BatchFeedPlan` | Uses `FeedType` enum — unchanged |
| `FeedRecord` | Uses `FeedType` + optional `inventoryItemId` — unchanged |
| Fattening dashboards | Unchanged |

**Verdict:** **No ration conflict**

---

## API / client backward compatibility

| Client | Impact |
|--------|--------|
| Mobile app (old) | Ignores `feedCatalogId` in responses; still works |
| Mobile app (new) | Optional catalog picker |
| Admin panel | New routes only |
| OpenAPI | Not yet generated — non-blocking |

---

## Name collision check

| Name | Collision |
|------|-----------|
| `FeedCategory` enum | Distinct from `ContentCategory` table |
| `FeedCatalog` model | Distinct from `InventoryItem` (farm catalog comment) |

---

## Overall

| Gate | Status |
|------|--------|
| Safe to deploy migration | **PASS** |
| Safe to run seed | **PASS** |
| Requires coordinated mobile release | **Soft** — catalog picker optional |
