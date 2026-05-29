# FEED_MULTI_SELECT_AND_BANGLADESH_FEED_MASTER_EXPANSION_V1

## Goal

Convert feed catalog selection from single-choice radio to multi-select composition UX, and expand Bangladesh feed master data with alias-aware search.

## Current State

| Area | Today |
|------|-------|
| Flutter UI | `RadioListTile` on `InventoryFeedCreatePage` — single `FeedCatalogItem?` |
| Selection model | `feedCatalogId: String?` on `InventoryAddInput` |
| Backend catalog | 18 seeded items in `prisma/seeds/feed_catalog.seed.ts` |
| Search | `nameEn` / `nameBn` contains only |
| Mobile offline seed | None (`assets/seeds/` missing) |

## Schema Changes

**No Prisma migration required.**

Extended metadata stored in existing `FeedCatalog.nutritionJson`:

```json
{
  "aliases": ["খৈল", "mustard cake"],
  "nutrientTags": ["protein", "energy"],
  "isPopular": true
}
```

API response adds optional fields: `aliases`, `nutrientTags`, `isPopular` (parsed from `nutritionJson`).

## Part A — Multi-Select UX (Flutter)

### Selection model

| Old | New |
|-----|-----|
| `FeedCatalogItem? _selectedCatalog` | `Set<String> _selectedCatalogIds` |
| `feedCatalogId` (single) | `feedCatalogIds[]` in draft; submit loops `addStock` per id |

### UI

- `FilterChip` grid replaces `RadioListTile`
- Summary bar: `Selected (N)` + removable chips
- Search field passes `q` to repository (server + client alias fallback)
- Draft key: `inventory_feed_create_draft` via `LocalCacheService`
- Backward compat: draft with legacy `feedCatalogId` → `[feedCatalogId]`

### Submit behaviour

Multi-select creates **one inventory stock item per catalog row** (existing `CREATE_ITEM` API, unchanged backend contract).

## Part B — Catalog Expansion

Expand `BANGLADESH_FEEDS` to **~40 items** covering:

- Roughage (8)
- Bran/Energy (7)
- Protein (6)
- Mineral (4)
- Commercial (4)
- Others (6)

Each row: `code`, `nameBn`, `nameEn`, `category`, `defaultUnit`, `approxPriceBdt`, `sortOrder`, `availabilityScore`, `aliases[]`, `nutrientTags[]`, `isPopular`.

## Part C — Search

Backend `mobileListFeedCatalog`: match `q` against `nameBn`, `nameEn`, `code`, and `nutritionJson.aliases[]`.

Flutter: pass `q` to API; client-side alias fallback when offline (asset seed).

## Part D — Mobile Offline Asset

`assets/seeds/feed_catalog.json` — static mirror of seed data for offline catalog reads.

## Migration Notes

- Existing inventory items unchanged (`feedCatalogId` remains single FK per row)
- Draft migration: `feedCatalogId` → `feedCatalogIds: [id]`
- Re-run seed: `pnpm db:seed:feed-catalog` (idempotent upsert by `code`)

## Files Changed

### Backend
- `prisma/seeds/feed_catalog.seed.ts`
- `src/legacy/web/lib/feed-catalog/mobile-catalog-service.ts`
- `src/shared/feed-catalog/catalog-meta.ts` (new — parse/map nutritionJson)

### Flutter
- `lib/features/feed_catalog/data/feed_catalog_dto.dart`
- `lib/features/feed_catalog/presentation/feed_catalog_providers.dart`
- `lib/features/feed_catalog/presentation/feed_catalog_multi_select.dart` (new widget)
- `lib/features/inventory/presentation/inventory_feed_create_page.dart`
- `lib/core/offline/local_cache_contract.dart`
- `assets/seeds/feed_catalog.json`
- `pubspec.yaml`

## Implementation Status

- [x] Multi-select UI + draft persistence
- [x] Backend seed expanded (37 items)
- [x] Alias search (`q=খৈল` → oilcakes)
- [x] Mobile offline asset `assets/seeds/feed_catalog.json`
- [x] `flutter run -d 192.168.10.107:5555` deployed
