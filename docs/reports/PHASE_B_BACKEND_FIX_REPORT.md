# Phase B — Backend Fix Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Plan:** [PHASE_B_BACKEND_FIX_PLAN.md](../plans/PHASE_B_BACKEND_FIX_PLAN.md)  
**Prior pass:** [backend-release-fix-plan.md](../releases/backend-release-fix-plan.md)

---

## Executive summary

| Gate | Baseline | Final | Status |
|------|----------|-------|--------|
| `npm ci` | **FAIL** (lock out of sync) | **PASS** | ✅ |
| `npm run build` | PASS (pnpm) | **PASS** | ✅ |
| `npm test` | PASS (385/385) | **385/385** | ✅ |
| Migration validation (`npm run db:audit`) | PASS | **PASS** | ✅ |

**Phase B verdict: PASS** — all success criteria met.

**Primary fix:** Regenerated `package-lock.json` to include `@sentry/node@9.47.1` and OpenTelemetry transitive dependencies. No application code changes required; prior release pass had already resolved TypeScript and test failures.

---

## Issues discovered

### P0 — npm lockfile drift (RC-B1)

| Field | Detail |
|-------|--------|
| **Symptom** | `npm ci` failed with `EUSAGE`: Missing `@sentry/node@9.47.1` and 50+ transitive packages from lock file |
| **Root cause** | `@sentry/node` added to `package.json`; `pnpm-lock.yaml` updated but `package-lock.json` not regenerated |
| **Impact** | CI/CD using `npm ci` blocked; local clean installs failed |
| **Fix** | `npm install` → refreshed `package-lock.json` (+802 / −35 lines) |

### Already resolved (prior release pass — no Phase B code changes)

| ID | Issue | Status |
|----|-------|--------|
| RC-1 | Wrong relative import depths (AI, legacy) | Fixed |
| RC-2 | Legacy Next.js guards in Express build | Fixed |
| RC-3 | `exactOptionalPropertyTypes` drift | Fixed |
| RC-4 | Prisma enum / API mismatch | Fixed |
| RC-5 | Dead module exclusions | Fixed |
| RC-6 | Test harness gaps | Fixed |
| RC-7 | Prisma `$transaction` typing | Fixed |
| RC-8 | Offline `leadDraft` relation shape | Fixed |

---

## Files modified (Phase B scope)

| File | Change |
|------|--------|
| `package-lock.json` | Synced with `package.json` — Sentry + OTel dependency tree |
| `docs/plans/PHASE_B_BACKEND_FIX_PLAN.md` | **New** — Phase B plan |
| `docs/reports/PHASE_B_BACKEND_FIX_REPORT.md` | **New** — this report |

**Application source (`src/`, `prisma/`):** No changes in Phase B implementation.

---

## Migrations reviewed

**Command:** `npm run db:audit`

```json
{
  "inventory": {
    "count": 59,
    "highRisk": 4,
    "nonReversible": 4,
    "duplicateTimestamps": 5
  },
  "prismaValidate": { "ok": true },
  "exitCode": 0
}
```

| Check | Result |
|-------|--------|
| Migration inventory | 59 migrations catalogued |
| Prisma schema validation | **OK** |
| High-risk migrations | 4 (documented in `reports/db/`) |
| Duplicate timestamps | 5 pairs (pre-existing, non-blocking) |
| Schema drift (env compare) | Skipped (`audit-only` mode) |
| pgTools | Unavailable (expected without local Postgres client) |
| Backup scripts | Present; on-disk gzip verify skipped (no `BACKUP_VERIFY_DIR`) |

---

## Security findings

### Critical / high — none new in Phase B

Existing controls verified present (no regressions):

| Control | Implementation |
|---------|----------------|
| JWT | `jose` HS256, context-specific secrets (`shared/security/jwt/`) |
| Passwords | bcryptjs via auth module |
| Rate limiting | Global + probe-exempt wrapper |
| Headers | Helmet + custom secure headers |
| Input sanitization | Security stack middleware |
| RBAC | `shared/security/rbac/` + route-level `authenticate` |
| Secrets | Env validation scripts; no secrets in repo |

### Medium / low (documented, not blocking)

| Finding | Severity | Notes |
|---------|----------|-------|
| npm audit: 3 moderate vulnerabilities | Medium | Includes `@hono/node-server` static middleware bypass (transitive); not direct Express surface |
| Dual package managers (npm + pnpm locks) | Low | Both locks should be updated when deps change |
| Legacy auth dual-stack | Low | Shared JWT + legacy panel paths until compat migration completes |
| `_archived_foundation` excluded from tests | Low | Intentional; not on production path |
| Duplicate migration timestamps | Low | Audit exit 0; documented in `reports/db/` |
| Worker BullMQ processors | Low | Scaffold only; no background job handlers yet |

---

## Fixes applied

1. **`npm install`** — Regenerated `package-lock.json` for `@sentry/node@^9.47.1` and full dependency tree.
2. **Verified clean install** — `npm ci` exit 0 after lock sync.
3. **Re-ran full gate suite** — build, test, db:audit from synced tree.

---

## Verification results

### 1. `npm ci`

```
added 633 packages, and audited 635 packages in 36s
```

**Exit code:** 0 · **Status:** PASS

### 2. `npm run build`

```
> npm run typecheck && tsc -p tsconfig.build.json
> tsc --noEmit -p tsconfig.build.json
```

**Exit code:** 0 · **Status:** PASS  
**Artifact:** `dist/server.js` present

### 3. `npm test`

```
 Test Files  98 passed (98)
      Tests  385 passed (385)
   Duration  30.23s
```

**Exit code:** 0 · **Status:** PASS

### 4. Migration validation (`npm run db:audit`)

```
"prismaValidate": { "ok": true }
"exitCode": 0
```

**Status:** PASS

---

## Remaining risks

1. **Keep lockfiles in sync** — When adding dependencies, run both `npm install` and `pnpm install` (or document single package manager for CI).
2. **npm audit moderates** — 3 moderate issues; review before production hardening sprint (avoid `npm audit fix --force` without testing).
3. **Legacy build boundary** — `src/legacy/**` excluded from `tsconfig.build.json`; runtime depends on compat-web — monitor during legacy migration.
4. **Live DB migration deploy** — Phase B validated filesystem audit only; staging `db:migrate:deploy` remains pre-release checklist item.

---

## Production readiness assessment

| Area | Readiness | Notes |
|------|-----------|-------|
| Dependency install (`npm ci`) | **Ready** | Lock synced |
| TypeScript compile | **Ready** | 0 errors |
| Test suite | **Ready** | 385/385 |
| Prisma schema | **Ready** | Validates OK |
| Migration inventory | **Ready** | 59 migrations audited |
| Security baseline | **Acceptable** | No critical gaps; moderate npm advisories tracked |
| Worker / queues | **Partial** | Scaffold only |

**Overall:** Backend meets Phase B gates for compile, test, dependency consistency, and migration validation. Suitable to proceed to integrated release verification with live DB migrate on staging.

---

## Sign-off

| Criterion | Result |
|-----------|--------|
| `npm ci` | PASS |
| `npm run build` | PASS |
| `npm test` | PASS |
| Migration validation | PASS |

**Phase B: PASS**
