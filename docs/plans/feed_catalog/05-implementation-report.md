# Feed Catalog — Final Implementation Report

**Task:** `BANGLADESH_FEED_MASTER_CATALOG_SEED_V1`  
**Completed:** 2026-05-24

---

## Delivered

### Planning & safety

| Doc | Path |
|-----|------|
| Audit | `docs/plans/feed_catalog/01-audit.md` |
| DB design | `docs/plans/feed_catalog/02-db-design.md` |
| Seed report | `docs/plans/feed_catalog/03-seed-report.md` |
| Conflict check | `docs/plans/feed_catalog/04-conflict-check.md` |
| This report | `docs/plans/feed_catalog/05-implementation-report.md` |

### Backend (`pranidoctor-backend`)

- Prisma: `FeedCategory` enum, `FeedCatalog` model, nullable `InventoryItem.feedCatalogId`
- Migration: `prisma/migrations/20260524180000_feed_catalog_master_v1/`
- Seed: `prisma/seeds/feed_catalog.seed.ts` — 18 Bangladesh feeds
- npm: `db:seed:feed-catalog`; wired into `prisma/seed.ts`
- Admin API: `GET/POST /api/admin/feed-catalog`, `GET/PATCH /api/admin/feed-catalog/:id` (no DELETE)
- Mobile API: `GET /api/mobile/feed-catalog`
- Inventory: `feedCatalogId` on `CREATE_ITEM` with master resolution
- Shared map: `src/shared/feed-catalog/category-map.ts`

### Web admin (`pranidoctor-web`)

- Proxies: `/api/admin/feed-catalog`, `/api/mobile/feed-catalog`
- Pages: `/admin/feed-catalog`, `/new`, `/[id]/edit`
- Nav: “খাদ্য ক্যাটালগ” under Semen/Breeding group

### Mobile (`pranidoctor_user`)

- `feed_catalog` feature — list API client
- `InventoryFeedCreatePage` — “তালিকা থেকে” vs “নিজের খাদ্য”
- `InventoryAddInput.feedCatalogId`

---

## What was NOT changed

- `FeedRecord` schema and mobile feed log flow (enum-based)
- Medicine inventory
- Treatment / prescription tables
- Stock engine transaction types
- Hard delete anywhere (soft `isActive` only)

---

## Deploy steps

1. **Backup DB** (production).
2. **Migrate:** `npm run db:migrate:deploy` (in `pranidoctor-backend`).
3. **Generate client:** `npm run db:generate`.
4. **Seed:** `npm run db:seed:feed-catalog` (or full `db:seed`).
5. **Deploy backend** then **web** then **mobile** (mobile backward compatible).

---

## Rollback instructions

### If migration not yet deployed

Delete migration folder and revert `schema.prisma` changes; redeploy previous backend build.

### If migration deployed, rollback required

1. **Stop** traffic to new admin/mobile catalog features.
2. **SQL rollback** (manual — Prisma has no auto-down):

```sql
ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_feedCatalogId_fkey";
DROP INDEX IF EXISTS "InventoryItem_feedCatalogId_idx";
ALTER TABLE "InventoryItem" DROP COLUMN IF EXISTS "feedCatalogId";
DROP TABLE IF EXISTS "FeedCatalog";
DROP TYPE IF EXISTS "FeedCategory";
```

3. Redeploy previous application binaries.
4. `npm run db:generate` on reverted schema.

**Note:** Rollback drops master catalog rows; farm `InventoryItem` rows remain but lose `feedCatalogId` link (display names preserved).

### If only seed wrong

Re-run seed after fixing `feed_catalog.seed.ts`; admin can patch prices. To reset seeded prices:

```sql
UPDATE "FeedCatalog" SET "approxPriceBdt" = NULL WHERE "isSeeded" = true;
```

Then `npm run db:seed:feed-catalog`.

---

## Verification checklist

- [ ] `npm run db:migrate:deploy` succeeds
- [ ] `npm run db:seed:feed-catalog` → 18 rows
- [ ] Admin list loads at `/admin/feed-catalog`
- [ ] Admin can edit price and disable (archive) item
- [ ] Mobile `GET /api/mobile/feed-catalog` returns items when authenticated
- [ ] Farmer: pick catalog feed → creates `InventoryItem` with `feedCatalogId`
- [ ] Farmer: custom feed → `feedCatalogId` null
- [ ] Existing inventory rows unchanged

---

## Follow-ups (optional)

- OpenAPI entries for new routes
- Pre-fill `FeedEntryFormPage` from inventory `feedType`/`unit`
- Fattening log feed + catalog integration
- `nutritionJson` editor in admin
