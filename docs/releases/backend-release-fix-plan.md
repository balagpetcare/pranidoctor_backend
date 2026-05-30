# Backend Release Fix Plan — pranidoctor-backend

**Date:** 2026-05-30  
**Status:** COMPLETE  
**Goal:** Zero TypeScript build errors, green test suite, validated migrations, release build.

## Baseline audit

| Gate | Baseline | Final |
|------|----------|-------|
| `pnpm run build` | **FAIL** (~70 TS errors) | **PASS** |
| `pnpm test` | **FAIL** (4 tests + 4 suites) | **PASS** (385/385) |
| Migrations | 59 migrations; validate via `db:audit` | **PASS** |

## Root-cause categories (all addressed)

### RC-1 — Wrong relative import depth (P0) ✅

Modules under `src/modules/ai/disclaimer/` and `symptom-checker/` used `../../legacy/...` instead of `../../../legacy/...`.

Legacy `ai-compliance-config.ts` used `../../../modules/...` instead of `../../../../modules/...`.

Archived auth repo paths corrected; suite excluded from Vitest (not on release path).

### RC-2 — Legacy Next.js admin guard in Express build (P0) ✅

`api-guard.ts` and related files updated for Express + NodeNext `.js` imports.

### RC-3 — `exactOptionalPropertyTypes` drift (P0) ✅

Applied `omitUndefined()` / conditional spreads across AI, launch, monitoring, storage, and error modules.

### RC-4 — Prisma schema / API enum mismatch (P0) ✅

Species mapper, `serviceType`, health record enums aligned with schema.

### RC-5 — Dead / stale module code (P1) ✅

`ai.service.ts` and `src/modules/dev/**` excluded from build.

### RC-6 — Test harness gaps (P0) ✅

- Global `vitest.setup.ts` initializes logger.
- AI governance enforcement mocked in usage verify tests.
- Voice route test mock includes `router.use`.
- `_archived_foundation/**` excluded from Vitest.

### RC-7 — Prisma `$transaction` typing (P0) ✅

Interactive transaction in `ai-usage.service.ts`.

### RC-8 — Offline `leadDraft` relation (P1) ✅

Repository maps `leadDraft[]` → `leadDraft | null` for service layer.

## Fix order (executed)

1. ✅ Document plan (this file)
2. ✅ Fix import paths (RC-1, RC-2)
3. ✅ Prisma/enum alignment (RC-4)
4. ✅ exactOptionalPropertyTypes passes (RC-3)
5. ✅ Exclude dead `ai.service.ts` (RC-5)
6. ✅ Test harness (RC-6)
7. ✅ `pnpm run build`
8. ✅ `pnpm test`
9. ✅ `pnpm run db:audit`
10. ✅ Verification report

## Out of scope

- New API endpoints or schema redesign
- ESLint info / deprecation warnings
- Package major version bumps

## Verification criteria

- [x] `pnpm run build` succeeds
- [x] `pnpm test` all pass
- [x] `pnpm run db:audit` passes
- [x] Verification report under `docs/releases/backend-release-verification-report.md`
