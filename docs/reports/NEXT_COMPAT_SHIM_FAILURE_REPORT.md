# Next Compat Shim Failure Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Error:** `ERR_MODULE_NOT_FOUND` — missing `src/compat/next-headers.ts` via `next@file:shims/next-compat`  
**Status:** **Repaired**

---

## Executive summary

| Item | Finding |
|------|---------|
| Root cause class | **B. Broken local package** |
| Intentional dependency? | **Yes** — shim replaces Next.js for legacy web routes on Express |
| Missing file? | **No** — `src/compat/next-headers.ts` existed; shim used an invalid cross-package relative path |
| Fix | Self-contained shim implementation + TypeScript declarations |
| `npm run build` | **Pass** |
| `npm run dev` | **Pass** (module resolution); exits later on unrelated MinIO env config |

---

## Root cause

The `next@file:./shims/next-compat` package is **intentional architecture**: legacy Next.js App Router handlers under `src/legacy/web/routes/` import `next/headers` and `next/server`. The backend mounts them via the Express compat layer (`src/modules/compat-web/`).

The shim entry files re-exported implementation from outside the package:

```js
// shims/next-compat/headers.js (before)
export { cookies, runWithExpressRequest } from '../../src/compat/next-headers.ts';
```

Under **pnpm**, the package resolves from:

```
node_modules/.pnpm/next@file+shims+next-compat/node_modules/next/headers.js
```

Relative `../../src/compat/` resolves to:

```
node_modules/.pnpm/next@file+shims+next-compat/src/compat/next-headers.ts  ← does not exist
```

instead of the project-root `src/compat/next-headers.ts`.

This is a **broken local package** layout issue, not a missing source file or accidental Next.js dependency.

---

## Why `next@file:shims/next-compat` exists

| Concern | Answer |
|---------|--------|
| Purpose | Provide minimal `next/headers` and `next/server` APIs for legacy web route handlers |
| Alternative considered | Remove `next` dependency | Rejected — would require rewriting ~15 legacy auth/guard modules |
| Real Next.js? | No — private 0.0.1-compat shim, not the Next.js framework |
| Documented? | Yes — `docs/backend-stabilization-phase-1.md`, `prisma/migrations/README`-style compat notes |

---

## Dependency chain (startup → `next/headers`)

### Primary chain (legacy panel session)

```
src/server.ts
  └─ bootstrap() → validateMobileProfileModules()
       └─ src/shared/config/mobile-profile-startup.ts
            └─ dynamic import: src/legacy/web/routes/admin/auth/login/route.ts
                 └─ re-export: src/modules/auth/compat/admin-auth.adapter.ts
                      └─ src/legacy/web/lib/admin-auth/session.ts
                           └─ import { cookies } from "next/headers"
                                └─ node_modules/next/headers.js  (shim)
                                     └─ [BROKEN] ../../src/compat/next-headers.ts
```

### Parallel consumers of `next/headers`

| File | Role |
|------|------|
| `src/legacy/web/lib/admin-auth/session.ts` | Admin panel cookie session |
| `src/legacy/web/lib/doctor-auth/session.ts` | Doctor panel cookie session |
| `src/legacy/web/lib/technician-auth/session.ts` | Technician panel cookie session |
| `src/legacy/web/lib/admin-auth/dashboard-guard.ts` | Admin dashboard guard |
| `src/legacy/web/lib/doctor-auth/dashboard-guard.ts` | Doctor dashboard guard |

### Express compat layer (direct import, not via shim)

```
src/modules/compat-web/next-adapter.ts
  └─ import { runWithExpressRequest } from '../../compat/next-headers.js'
       └─ src/compat/next-headers.ts  (re-exports shim implementation)
```

### `next/server` chain (type + runtime)

Legacy guards and compat adapters import `NextResponse` from `next/server` → `shims/next-compat/server.js` (same broken re-export pattern, same fix applied).

---

## Root cause classification

| Option | Applies? | Notes |
|--------|----------|-------|
| A. Missing shim file | No | `src/compat/next-headers.ts` was present |
| **B. Broken local package** | **Yes** | Shim re-exports used paths invalid under pnpm install layout |
| C. Invalid backend dependency | No | Dependency is required for legacy compat |
| D. Incorrect import path | Partial | Path was wrong **inside the shim**, not in application code |
| E. Build artifact corruption | No | Failure reproduced in dev (`tsx`) before build |

---

## Fix applied

### 1. Self-contained shim (runtime)

Moved implementation into the shim package so all imports stay **within** `shims/next-compat/`:

| File | Change |
|------|--------|
| `shims/next-compat/headers.js` | Full `cookies()` + `runWithExpressRequest()` implementation (AsyncLocalStorage + cookie parsing) |
| `shims/next-compat/server.js` | Full `NextResponse` implementation |
| `shims/next-compat/headers.d.ts` | TypeScript declarations |
| `shims/next-compat/server.d.ts` | TypeScript declarations |
| `shims/next-compat/package.json` | Version bump; conditional exports with `types` + `default` |

### 2. Compat layer re-exports (single public TS surface)

| File | Change |
|------|--------|
| `src/compat/next-headers.ts` | Re-exports from `../../shims/next-compat/headers.js` |
| `src/compat/next-server.ts` | Re-exports from `../../shims/next-compat/server.js` |

### 3. Not changed

- Legacy `import { cookies } from "next/headers"` — preserved (compat contract)
- `package.json` `"next": "file:./shims/next-compat"` — preserved (intentional)
- No temporary hacks, no duplicate Next.js install

---

## Verification results

| Command | Result |
|---------|--------|
| `node --import tsx -e "import { cookies } from 'next/headers'"` | **Pass** |
| `node --import tsx -e "import './src/legacy/web/lib/admin-auth/session.ts'"` | **Pass** |
| `npm run build` | **Pass** (typecheck + tsc) |
| `npm run dev:no-docker` | **Pass** module load; reaches `Starting server` + DB init |

### Post-fix log excerpt

```
INFO: Starting server (port: 3000)
INFO: Database client initialized
```

No `ERR_MODULE_NOT_FOUND` / P3015-style module errors.

**Note:** Dev then exits with `FATAL: MinIO bootstrap failed — MEDIA_STORAGE=s3 requires storage`. That is **environment configuration**, unrelated to the Next compat shim.

---

## Remaining risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Unshimmed Next.js subpaths | **Medium** | `next/navigation` (`redirect`) and `next/font/google` are imported in legacy dashboard code but **not exported** by the shim. Hitting those routes may fail at runtime. Add shims if those routes are mounted. |
| pnpm `file:` snapshot | **Low** | pnpm hardlinks top-level shim files; new subdirectories under `shims/next-compat/` may not appear in `node_modules` until reinstall. Current fix uses flat `headers.js` / `server.js` only. |
| Dual maintenance | **Low** | Implementation lives in shim JS; `src/compat/` re-exports for TypeScript consumers. Keep changes in shim first, then verify compat re-exports. |
| Production `node dist/server.js` | **Low** | Legacy routes still resolve `next/headers` via `node_modules/next` at runtime; self-contained JS shim works without `tsx`. |

---

## Files involved

| Path | Role |
|------|------|
| `package.json` | Declares `"next": "file:./shims/next-compat"` |
| `pnpm-lock.yaml` | Locks file dependency |
| `shims/next-compat/package.json` | Shim package manifest |
| `shims/next-compat/headers.js` | `next/headers` runtime implementation |
| `shims/next-compat/server.js` | `next/server` runtime implementation |
| `shims/next-compat/headers.d.ts` | Types for headers shim |
| `shims/next-compat/server.d.ts` | Types for server shim |
| `src/compat/next-headers.ts` | Backend compat re-export |
| `src/compat/next-server.ts` | Backend compat re-export |
| `src/types/next-shim.d.ts` | Ambient module declarations |
| `src/modules/compat-web/next-adapter.ts` | Express ↔ Web Request bridge |
| `src/legacy/web/lib/*-auth/session.ts` | Legacy consumers of `next/headers` |

---

## Recommended follow-ups (optional)

1. Add minimal shims for `next/navigation` (`redirect`) if dashboard guard routes are exercised.
2. Document in `shims/next-compat/README.md` that implementation must stay inside the package directory (pnpm-safe).
3. Add a startup smoke test importing `next/headers` and `next/server` in CI.
