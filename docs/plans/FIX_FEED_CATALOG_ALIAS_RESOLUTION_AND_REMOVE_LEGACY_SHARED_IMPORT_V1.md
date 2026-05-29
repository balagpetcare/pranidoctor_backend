# FIX_FEED_CATALOG_ALIAS_RESOLUTION_AND_REMOVE_LEGACY_SHARED_IMPORT_V1

## Problem

`GET /api/mobile/feed-catalog` returns **500** at runtime:

```
Cannot find package '@/shared'
Imported from: src/legacy/web/lib/feed-catalog/category-map.ts
```

Other mobile endpoints (`/mobile/feeds`, `/mobile/inventory`, `/mobile/inventory/feed`) work.

## Root Cause

`src/legacy/web/lib/feed-catalog/category-map.ts` is a one-line re-export:

```ts
export { feedCategoryToFeedType } from "@/shared/feed-catalog/category-map";
```

The alias `@/shared/*` **does not exist** in `tsconfig.json`. Valid aliases are:

| Alias | Maps to |
|-------|---------|
| `@shared/*` | `src/shared/*` |
| `@/lib/*` | `src/legacy/web/lib/*` |
| `@/generated/prisma/client` | `src/generated/prisma/client.ts` |

There is no `@/shared` entry. At runtime (tsx + ESM), Node tries to resolve `@/shared` as a package name and fails when the mobile feed-catalog route lazy-loads `mobile-catalog-service` → `./category-map`.

Canonical implementation lives at `src/shared/feed-catalog/category-map.ts`.

## Dependency Graph

```
mobile/feed-catalog/route.ts
  └─ mobile-catalog-service.ts
       └─ ./category-map.ts          ← broken @/shared import
            └─ (intended) shared/feed-catalog/category-map.ts
```

## Fix

Replace the invalid alias with a relative ESM import (project convention uses `.js` extensions):

```ts
export { feedCategoryToFeedType } from "../../../../shared/feed-catalog/category-map.js";
```

No new adapters or duplicate logic — reuses the existing shared mapper. The legacy shim stays as a thin boundary so `mobile-catalog-service.ts` does not need path changes.

Also extend `scripts/fix-legacy-imports.mjs` to rewrite `@/shared/*` → relative paths when legacy files are re-copied from web.

## Files Changed

| File | Change |
|------|--------|
| `src/legacy/web/lib/feed-catalog/category-map.ts` | Fix import path |
| `scripts/fix-legacy-imports.mjs` | Add `@/shared/*` rewrite rule |

## Compatibility Notes

- **API contract unchanged** — response shape `{ items: [...] }` with `legacyFeedType` field preserved.
- **Mobile Flutter** — no client changes; same endpoint and DTO fields.
- **Admin routes** — unaffected (do not import `category-map.ts`).

## Verification

```bash
pnpm typecheck
pnpm build
pnpm dev
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/mobile/feed-catalog?limit=200"
```

Expected: HTTP 200 with `{ ok: true, data: { items: [...] } }`.

### Verification results (2026-05-24)

```text
# category-map re-export resolves
npx tsx -e "import { feedCategoryToFeedType } from './src/legacy/web/lib/feed-catalog/category-map.ts'; ..."
→ OK CONCENTRATE

# service returns DB rows
mobileListFeedCatalog({ limit: 5 }) → items 5

# route lazy-load (same path compat-web uses)
import(route.ts) → GET function
```

## Implementation Status

- [x] Plan documented
- [x] Import path corrected
- [x] fix-legacy-imports updated
- [x] Runtime verification (module import + DB query + route lazy-load)
- [ ] Full `pnpm typecheck` (pre-existing unrelated errors in repo)
- [ ] Authenticated HTTP 200 (requires seeded customer credentials)
