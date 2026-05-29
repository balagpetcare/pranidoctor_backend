# FIX_MOBILE_FEEDS_LEGACY_INVENTORY_IMPORT_AND_RESTORE_BACKWARD_COMPAT_V1

## Problem

`GET /api/mobile/feeds` returns HTTP 500 because `feed-service.ts` fails at module load time.

**Error:** `Cannot find module src/legacy/modules/inventory/inventory.service.js`

## Root cause

`src/legacy/web/lib/mobile-feeds/feed-service.ts` uses a **wrong relative path**:

```ts
import { getInventoryService } from "../../../modules/inventory/inventory.service.js";
```

Resolved from `src/legacy/web/lib/mobile-feeds/`:

| Segment | Resolves to |
|---------|-------------|
| `../` × 3 | `src/legacy/` |
| `modules/inventory/...` | `src/legacy/modules/inventory/` (**does not exist**) |

The active inventory implementation lives at **`src/modules/inventory/`** (used by mobile inventory routes via `../../../../../../modules/inventory/index.js`).

Because the import is **top-level static**, Node fails when loading `feed-service.ts` for **any** feeds handler—including `GET` list, which never calls inventory.

## Import chain

```
src/legacy/web/routes/mobile/feeds/route.ts
  → @/lib/mobile-feeds/feed-service
    → ../../../modules/inventory/inventory.service.js  ❌ (legacy path)
```

Working reference (inventory feed route):

```
src/legacy/web/routes/mobile/inventory/feed/route.ts
  → ../../../../../../modules/inventory/index.js  ✅
```

## Solution

1. **Remove** broken legacy-relative imports from `feed-service.ts`.
2. **Add** `adapters/inventory-feed.adapter.ts` that dynamically imports `@modules/inventory/index.js` (tsconfig alias → `src/modules/inventory/`).
3. **Use adapter** only inside `createFeedForCustomer` when `deductStock && inventoryItemId`—so list/analytics/cost routes load without touching inventory.
4. **Preserve** `consumeForFeedRecord` contract and mobile JSON responses (no route/schema changes).
5. **No adapter mapping** of DTO shapes required—the new `InventoryService.consumeForFeedRecord` is the intended implementation.

## Files to change

| File | Action |
|------|--------|
| `docs/plans/FIX_MOBILE_FEEDS_..._V1.md` | This plan |
| `src/legacy/web/lib/mobile-feeds/adapters/inventory-feed.adapter.ts` | New lazy-load bridge |
| `src/legacy/web/lib/mobile-feeds/feed-service.ts` | Use adapter; drop static legacy imports |

## Backward compatibility

| Endpoint | Impact |
|----------|--------|
| `GET /api/mobile/feeds` | Fixed (module loads) |
| `POST /api/mobile/feeds` (no stock deduct) | Unchanged |
| `POST /api/mobile/feeds` (`deductStock`) | Same stock errors (`INSUFFICIENT_STOCK`, etc.) via existing route mapping |
| `GET /api/mobile/inventory/feed` | Unchanged (already correct import) |

Mobile response contracts unchanged.

## Validation

```bash
pnpm typecheck
pnpm build
# With dev server:
curl GET /api/mobile/feeds
curl GET /api/mobile/inventory/feed?farmRef=...
```

Both must return 200 (with valid auth).

## Rollback

Revert adapter + `feed-service.ts` import changes; no DB migration.
