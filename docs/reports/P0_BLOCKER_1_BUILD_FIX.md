# P0 BLOCKER-1 — Production Build Fix Report

**Date:** 2026-05-30  
**Objective:** Make `npm run build` pass with zero TypeScript errors  
**Status:** **RESOLVED**

---

## Summary

Production build failed because legacy admin-auth modules imported `getExpressRequest` from `next/headers`, but the ambient TypeScript shim declaration only exported `cookies()`. Runtime already provided `getExpressRequest`; the failure was **types-only**.

---

## Failure (before fix)

```text
src/legacy/web/lib/admin-auth/api-guard.ts(2,10): error TS2305:
  Module '"next/headers"' has no exported member 'getExpressRequest'.
src/legacy/web/lib/admin-auth/session.ts(1,19): error TS2305:
  Module '"next/headers"' has no exported member 'getExpressRequest'.
```

---

## Root cause

| Layer | State |
|-------|--------|
| **Runtime** (`shims/next-compat/headers.js`) | Exports `cookies`, `getExpressRequest`, `runWithExpressRequest` |
| **Shim types** (`shims/next-compat/headers.d.ts`) | Complete — includes all three exports |
| **Ambient types** (`src/types/next-shim.d.ts`) | **Incomplete** — only declared `cookies()` |

TypeScript resolves `next/headers` via the ambient `declare module 'next/headers'` in `src/types/next-shim.d.ts` (included in `tsconfig.build.json`). That declaration shadowed the package types and omitted `getExpressRequest`.

Legacy admin-auth files are typechecked even though `src/legacy/**` is excluded from compilation, because non-legacy modules import them:

- `src/modules/ai/ai-admin.http.ts` → `api-guard.ts`
- `src/modules/admin-analytics/admin-analytics.http.ts` → `api-guard.ts`

Admin-auth code is **actively used** (100+ legacy routes + Express admin HTTP handlers). No dead-code removal was warranted.

---

## Fix applied

### 1. `src/types/next-shim.d.ts`

Extended the `next/headers` module declaration to match the runtime shim:

- `runWithExpressRequest(req, fn)`
- `getExpressRequest()`
- `cookies()`

Uses `import type { Request } from 'express'` for accurate Express request typing.

### 2. `src/compat/next-headers.ts`

Re-exported `getExpressRequest` alongside existing `cookies` and `runWithExpressRequest` exports so the internal compat layer mirrors the public shim surface.

**No `@ts-ignore` used. No runtime behavior changed.**

---

## Validation results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run build` | **PASS** | `typecheck` + `tsc -p tsconfig.build.json` — zero TS errors |
| `npm test` | **PASS** | 394/394 tests (100 files) |
| `npm run lint` | **FAIL (pre-existing)** | ~26k repo-wide issues (import/order, test file parser config, etc.) |
| `eslint` on changed files | **PASS** | `src/types/next-shim.d.ts`, `src/compat/next-headers.ts` clean |

The BLOCKER-1 scope was TypeScript production build failure. Lint failures predate this change and are tracked separately.

---

## Files changed

| File | Change |
|------|--------|
| `src/types/next-shim.d.ts` | Full `next/headers` type surface |
| `src/compat/next-headers.ts` | Export `getExpressRequest` |

---

## Follow-up (optional, not blocking)

1. **Shim install:** `node_modules/next/` currently lacks `headers.d.ts` / `server.d.ts` (only `.js` copied). Consider `npm install` / postinstall sync so package `exports.types` resolve without relying solely on `next-shim.d.ts`.
2. **Lint debt:** Run `eslint --fix` and align ESLint `parserOptions.project` with test files to restore `npm run lint` as a CI gate.
3. **CI:** Add `npm run build` to CI if not already present.

---

## Conclusion

P0 BLOCKER-1 is resolved. Production build and tests pass. Admin-auth compat layer remains intact and correctly typed against the Express AsyncLocalStorage shim.
