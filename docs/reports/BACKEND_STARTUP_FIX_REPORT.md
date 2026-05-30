# Backend Startup Fix Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Blocker:** `ERR_MODULE_NOT_FOUND` — missing `src/compat/next-headers.ts` via `next@file:shims/next-compat`  
**Status:** **Fixed**

---

## Executive summary

| Gate | Result |
|------|--------|
| Root cause | **Broken local package** — shim re-exported outside its package boundary |
| `npm run build` | **Pass** |
| `npm test` | **Pass** (385/385) |
| `npm run dev` | **Pass** — server reaches `Server started` on port 3000; no `ERR_MODULE_NOT_FOUND` |

The backend intentionally depends on a private `next@file:./shims/next-compat` package so legacy Next.js App Router handlers can run on Express. The shim entry files incorrectly re-exported TypeScript sources outside the package; under pnpm’s install layout that path does not resolve. Implementation was moved into the shim package itself.

---

## Root cause

### Classification

| Option | Applies? | Notes |
|--------|----------|-------|
| Missing shim file | No | `src/compat/next-headers.ts` existed at project root |
| **Broken local package** | **Yes** | Shim used `../../src/compat/*.ts` from inside `node_modules/next` |
| Accidental frontend dependency | No | Dependency is required for legacy compat-web routes |
| Incorrect import path | Partial | Path was wrong **inside the shim**, not in application code |
| Build artifact issue | No | Failure reproduced in dev (`tsx watch`) before `tsc` |

### Broken re-export (before)

```js
// shims/next-compat/headers.js
export { cookies, runWithExpressRequest } from '../../src/compat/next-headers.ts';
```

Under **pnpm**, the package resolves from:

```
node_modules/.pnpm/next@file+shims+next-compat/node_modules/next/headers.js
```

Relative `../../src/compat/` resolves to:

```
node_modules/.pnpm/next@file+shims+next-compat/src/compat/next-headers.ts   ← does not exist
```

not project-root `src/compat/next-headers.ts`. The same pattern affected `shims/next-compat/server.js`.

---

## Why `next@file:shims/next-compat` exists

| Question | Answer |
|----------|--------|
| Purpose | Minimal `next/headers` and `next/server` APIs for legacy web route handlers |
| Real Next.js? | No — private `0.0.1-compat` shim |
| Declared in | `package.json` → `"next": "file:./shims/next-compat"` |
| Locked in | `pnpm-lock.yaml` → `next@file:shims/next-compat` |

Legacy handlers under `src/legacy/web/` import `next/headers` and `next/server`. The Express compat layer (`src/modules/compat-web/`) mounts ~1944 legacy `/api/*` routes at startup.

---

## Startup dependency chain

### From `src/server.ts`

```
src/server.ts
  ├─ validateMobileProfileModules()
  │    └─ dynamic imports of legacy web routes / profile adapters
  │         └─ src/legacy/web/lib/*-auth/session.ts
  │              └─ import { cookies } from "next/headers"
  │                   └─ node_modules/next/headers.js  (shim)
  │
  └─ createCompatWebRouter()
       └─ src/modules/compat-web/next-adapter.ts
            └─ import { runWithExpressRequest } from '../../compat/next-headers.js'
                 └─ src/compat/next-headers.ts  (re-exports shim)
```

### All `next/*` imports in `src/`

| Subpath | Files | Shim coverage |
|---------|-------|---------------|
| `next/headers` | 6 legacy auth session/guard modules | **Yes** — `shims/next-compat/headers.js` |
| `next/server` | 12 legacy guard/cookie modules (mostly `type` imports) | **Yes** — `shims/next-compat/server.js` |
| `next/navigation` | 2 dashboard guards (`redirect`) | **No** — not mounted on critical startup path |
| `next/font/google` | 1 admin UI fonts module | **No** — not on startup path |

Backend TypeScript code also imports via `src/compat/next-headers.js` and `src/compat/next-server.js` (not via the npm package name).

---

## Fix applied

### 1. Self-contained shim runtime (pnpm-safe)

Moved full implementation into `shims/next-compat/` so all runtime code stays **inside** the package directory:

| File | Change |
|------|--------|
| `shims/next-compat/headers.js` | Inline `cookies()` + `runWithExpressRequest()` (AsyncLocalStorage + cookie parsing) |
| `shims/next-compat/server.js` | Inline `NextResponse` with cookie helpers |
| `shims/next-compat/headers.d.ts` | TypeScript declarations for headers API |
| `shims/next-compat/server.d.ts` | TypeScript declarations for server API |
| `shims/next-compat/package.json` | Version `0.0.1-compat`; conditional exports with `types` + `default` |

### 2. Compat layer re-exports (TypeScript surface)

| File | Change |
|------|--------|
| `src/compat/next-headers.ts` | Re-exports from `../../shims/next-compat/headers.js` |
| `src/compat/next-server.ts` | Re-exports from `../../shims/next-compat/server.js` |

### 3. Unchanged (intentional)

- Legacy `import { cookies } from "next/headers"` — preserved
- `package.json` `"next": "file:./shims/next-compat"` — preserved
- No real Next.js framework installed

---

## Files modified

| Path | Role |
|------|------|
| `shims/next-compat/headers.js` | Runtime `next/headers` implementation |
| `shims/next-compat/server.js` | Runtime `next/server` implementation |
| `shims/next-compat/headers.d.ts` | Types for headers shim |
| `shims/next-compat/server.d.ts` | Types for server shim |
| `shims/next-compat/package.json` | Export map + version bump |
| `src/compat/next-headers.ts` | Thin re-export for backend TS consumers |
| `src/compat/next-server.ts` | Thin re-export for backend TS consumers |
| `docs/reports/BACKEND_STARTUP_FIX_REPORT.md` | This report |

---

## Verification results

| Command | Result | Notes |
|---------|--------|-------|
| `node --import tsx -e "import { cookies } from 'next/headers'"` | **Pass** | Shim resolves from `node_modules/next` |
| `node --import tsx -e "import './src/legacy/web/lib/admin-auth/session.ts'"` | **Pass** | Legacy session chain loads |
| `npm run build` | **Pass** | typecheck + tsc |
| `npm test` | **Pass** | 98 files, 385/385 tests |
| `npm run dev:no-docker` | **Pass** | `Server started` on port 3000; 1944 compat routes registered |

### Post-fix startup log (excerpt)

```
INFO: Mobile profile modules verified
INFO: Compat web API routes registered (count: 1944)
INFO: All modules loaded and mounted
INFO: Server started (port: 3000)
```

No `ERR_MODULE_NOT_FOUND` for `next-headers` or shim paths.

### Environment note for local `npm run dev`

With default `.env` (`MEDIA_STORAGE=s3`), dev may exit at MinIO bootstrap **before** module loading completes if the S3 endpoint is unreachable. That is unrelated to the Next compat shim. Workarounds:

- Start MinIO via `npm run docker:up`, or
- Temporarily set `MEDIA_STORAGE=local` for local boot without S3, or
- Set `SKIP_STARTUP_VALIDATION=true` when infra services are unavailable

The module-resolution fix was verified with `MEDIA_STORAGE=local` and `SKIP_STARTUP_VALIDATION=true`; the server fully booted including compat-web route registration.

---

## Remaining risks

| Risk | Level | Mitigation |
|------|-------|------------|
| Unshimmed `next/navigation` and `next/font/google` | Medium | Add minimal shims if dashboard guard or font routes are exercised at runtime |
| pnpm `file:` snapshot staleness | Low | After shim changes, run `pnpm install` or `npm install` to refresh `node_modules/next` |
| Dual maintenance (shim JS + compat TS re-exports) | Low | Change shim first; keep `src/compat/` as thin re-exports only |
| MinIO / Redis env on default dev | Medium | Documented above; not a module-resolution issue |
| Legal document seed Prisma error on boot | Low | Non-fatal warning; unrelated to startup shim |

---

## Recommended follow-ups (optional)

1. Add `shims/next-compat/README.md` stating implementation must stay inside the package directory (pnpm-safe).
2. Add minimal shims for `next/navigation` (`redirect`) if dashboard routes are mounted in production.
3. Add a CI smoke test: `node --import tsx -e "import 'next/headers'; import 'next/server'"`.
