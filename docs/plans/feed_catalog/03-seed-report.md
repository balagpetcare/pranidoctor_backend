# Feed Catalog Seed Report — Bangladesh V1

**Script:** `prisma/seeds/feed_catalog.seed.ts`  
**Command:** `npm run db:seed:feed-catalog` (also runs from `npm run db:seed`)

---

## Seed rules applied

| Rule | Implementation |
|------|----------------|
| Upsert only | `findUnique` by `code` → `create` or `update` |
| No duplicates | Unique `code` constraint |
| Rerunnable | Safe to run multiple times |
| Preserve data | Re-run does **not** overwrite `approxPriceBdt` if already set |
| Configurable prices | `FEED_CATALOG_PRICE_MULTIPLIER` env (default `1`) on **create** only |
| No hard dependency | Standalone script; optional in main seed |
| Master untouched by farmers | Farmers only link via `InventoryItem.feedCatalogId` |

---

## Seeded items (18)

| Code | nameBn | Category | Unit | approxPriceBdt |
|------|--------|----------|------|----------------|
| bd-rice-straw | ধানের খড় | ROUGHAGE | BUNDLE | 10 |
| bd-wheat-straw | গমের খড় | ROUGHAGE | BUNDLE | 12 |
| bd-straw-generic | খড় | ROUGHAGE | BUNDLE | 9 |
| bd-napier-grass | নেপিয়ার | GREEN | KG | 3 |
| bd-german-grass | জার্মান ঘাস | GREEN | KG | 4 |
| bd-maize-fodder | ভুট্টা ঘাস | GREEN | KG | 5 |
| bd-local-grass | স্থানীয় ঘাস | GREEN | KG | 2 |
| bd-wheat-bran | গম ভুসি | CONCENTRATE | KG | 32 |
| bd-rice-bran | চালের কুঁড়া | CONCENTRATE | KG | 25 |
| bd-maize-grain | ভুট্টা | CONCENTRATE | KG | 34 |
| bd-soybean-meal | সয়াবিন খৈল | CONCENTRATE | KG | 60 |
| bd-mustard-cake | সরিষার খৈল | CONCENTRATE | KG | 50 |
| bd-ready-feed | রেডিমেড ফিড | CONCENTRATE | KG | 48 |
| bd-molasses | মোলাসেস | SUPPLEMENT | LITER | 40 |
| bd-mineral-mix | মিনারেল মিক্স | MINERAL | KG | 95 |
| bd-salt | লবণ | MINERAL | KG | 20 |
| bd-maize-silage | ভুট্টা সাইলেজ | SILAGE | KG | 15 |
| bd-grass-silage | ঘাস সাইলেজ | SILAGE | KG | 12 |

Prices reflect approximate Bangladesh market reference (2025–2026); adjust in admin panel.

---

## Category coverage

| FeedCategory | Count |
|--------------|-------|
| ROUGHAGE | 3 |
| GREEN | 4 |
| CONCENTRATE | 6 |
| SUPPLEMENT | 1 |
| MINERAL | 2 |
| SILAGE | 2 |
| **Total** | **18** |

---

## Post-seed verification

```sql
SELECT category, COUNT(*) FROM "FeedCatalog" WHERE "isSeeded" = true GROUP BY category;
SELECT code, "nameBn", "approxPriceBdt", "isActive" FROM "FeedCatalog" ORDER BY "sortOrder";
```

---

## Environment

| Variable | Purpose |
|----------|---------|
| `FEED_CATALOG_PRICE_MULTIPLIER` | Scale reference prices on **first create** only |
