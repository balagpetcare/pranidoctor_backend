# Phase B — Backend Fix Plan

**Project:** pranidoctor-backend (Prani Doctor / Animal Doctors Platform)  
**Date:** 2026-05-30  
**Goal:** `npm ci` · `npm test` · `npm run build` · migration validation — all pass

---

## Backend architecture assessment

| Layer | Technology | Notes |
|-------|------------|-------|
| Runtime | Node ≥20, ESM (`"type": "module"`) | `dist/server.js` entry |
| HTTP | Express 5 modular monolith | `createApp()` + module loader at `/api` |
| Legacy | Next-compat routes under `src/legacy/web/` | Mounted via `compat-web` module |
| ORM | Prisma 7.8 → `src/generated/prisma` | PostgreSQL |
| Queue | BullMQ + Redis | Worker scaffold (`worker.ts`) |
| Auth | jose JWT + session/RBAC middleware | Dual stack: shared + legacy panel/mobile |
| Validation | Zod DTOs | Per-module |
| Tests | Vitest 4 | ~94 test files, `vitest.setup.ts` |
| Observability | Pino, Sentry, Prometheus metrics | |

**Entry points:** `src/server.ts` (API), `src/worker.ts` (background).

**Middleware order:** helmet → secure headers → sanitize → CORS → compression → body parsers → context → metrics → logger → health → rate limit → routes → notFound → errorHandler.

---

## Module dependency map (high level)

```
server.ts
  ├── shared/config, logger, monitoring (Sentry)
  ├── shared/database/prisma
  ├── infra/ (redis, queue, cache, storage)
  ├── app.ts (Express shell + security stack)
  ├── modules/compat-web → legacy/web/routes/*
  └── loadModules() → modules/* (auth, ai, livestock, feed, offline, …)
```

**Critical coupling:** Runtime imports legacy libs (storage, OTP, admin routes) while `tsconfig.build.json` excludes `src/legacy/**` — intentional compile-time boundary; legacy code consumed via compat layer and non-excluded re-exports. Prior release pass validated build + tests with current exclusions.

---

## API health assessment

| Area | Status (baseline) |
|------|-------------------|
| Health routes | `src/api/health/` — liveness, AI health, mobile health |
| Metrics | Prometheus under `/metrics` (configurable) |
| OpenAPI | `scripts/generate-openapi.mjs` |
| Mobile modules | `validate:mobile-modules` script |

---

## Database assessment

- **Provider:** PostgreSQL via Prisma
- **Schema:** ~3900 lines, 100+ models
- **Migrations:** 58–59 folders under `prisma/migrations/`
- **Validation tooling:** `scripts/db/run-validation.mjs` (`db:audit`, `db:validate`)

**Known audit findings (pre-existing):**
- Duplicate migration timestamps (5 pairs) — documented, non-blocking
- 4 high-risk / non-reversible migrations — documented in `reports/db/`

---

## Prisma assessment

- Client generated to `src/generated/prisma`
- `prisma validate` run as part of `db:audit`
- Schema uses enums, cascades, indexes on hot paths (User, sessions, devices)

---

## Migration assessment

| Check | Tool | Expected |
|-------|------|----------|
| Inventory | `migration-inventory.mjs` | All SQL files catalogued |
| Schema valid | `prisma validate` | OK |
| Safety checklist | `migration-safety.mjs` | Warnings documented |
| Live DB apply | `db:validate` (needs DATABASE_URL) | Optional in CI shell |

Phase B gate: **`npm run db:audit`** (filesystem + schema, no live DB required).

---

## Security assessment

| Control | Location | Phase B action |
|---------|----------|----------------|
| JWT (jose) | `shared/security/jwt/` | Verify no regressions |
| Password hashing | bcryptjs in auth module | No changes |
| Rate limiting | `shared/security/rate-limit` | Verify middleware order |
| Helmet / headers | `security-stack.ts` | No changes |
| Input sanitization | security middleware | No changes |
| RBAC | `shared/security/rbac/` | Document medium risks |
| Secrets | `.env.*.example`, `env-validate.ts` | No secrets in repo |
| File upload | multer + sharp + S3 | Existing guards |
| Tenant/branch isolation | Per-module scoping | Document, no schema change |

---

## Test assessment

| Metric | Baseline (prior pass) | Phase B target |
|--------|----------------------|----------------|
| Test files | ~94 | All green |
| Tests | 385 | All green |
| Excluded | `_archived_foundation/**` | Intentional |

Harness: `vitest.setup.ts` (logger), AI governance mocks in usage tests.

---

## Build assessment

| Gate | Baseline | Blocker |
|------|----------|---------|
| `npm ci` | **FAIL** | `package-lock.json` out of sync (`@sentry/node` + OTel tree missing from lock) |
| `npm run build` | PASS (via pnpm prior) | Re-verify after lock sync |
| `npm test` | PASS (385/385 via pnpm) | Re-verify after lock sync |
| `npm run db:audit` | PASS | Re-run |

**Note:** Repo contains both `pnpm-lock.yaml` (current for dev) and `package-lock.json` (stale). Phase B success criteria require **`npm ci`** — lock file must be regenerated from `package.json`.

---

## Root-cause analysis

### RC-B1 — npm lockfile drift (P0)

**Symptoms:** `npm ci` fails with `EUSAGE` — missing `@sentry/node@9.47.1` and OpenTelemetry transitive deps in `package-lock.json`.

**Cause:** `@sentry/node` added to `package.json`; lock updated for pnpm but not npm.

**Fix:** Run `npm install` to refresh `package-lock.json`; verify `npm ci` on clean tree.

### RC-B2 — Dual package managers (P1)

**Symptoms:** pnpm-lock current, npm lock stale.

**Fix:** Sync npm lock for Phase B gate; document pnpm as dev alternative.

### RC-B3 — Prior TS/test fixes (resolved)

Import paths, exactOptionalPropertyTypes, Prisma enums, test harness — completed in backend release pass (see `docs/releases/backend-release-fix-plan.md`).

---

## Remediation strategy

```
1. Complete this plan
2. npm install → sync package-lock.json (RC-B1)
3. npm ci (clean verify)
4. npm run build
5. npm test
6. npm run db:audit
7. Security spot-check (no code change unless regression)
8. PHASE_B_BACKEND_FIX_REPORT.md
9. PHASE_B verification if needed
```

**Out of scope:** New endpoints, schema redesign, ESLint mass cleanup, package major bumps, live DB migration deploy.

---

## Verification strategy

| Step | Command | Pass criteria |
|------|---------|---------------|
| 1 | `npm ci` | Exit 0 |
| 2 | `npm run build` | Exit 0, `dist/server.js` exists |
| 3 | `npm test` | All tests pass |
| 4 | `npm run db:audit` | Exit 0, prisma validate OK |

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| npm lock regen breaks pnpm users | Medium | Low | Keep pnpm-lock in sync via `pnpm import` if needed |
| Legacy build exclusion hides runtime gaps | Low | Medium | Prior release verified build; compat-web path tested |
| Duplicate migration timestamps | Low | Medium | Documented; db:audit exit 0 |
| No live Postgres in CI shell | High | Low | `db:audit` is filesystem gate; `db:validate` optional |

---

## Verification checklist

- [x] `npm ci` succeeds
- [x] `npm run build` succeeds
- [x] `npm test` — all pass
- [x] `npm run db:audit` passes
- [x] Plan and report documented
- [x] No business logic removed
- [x] Critical security issues addressed or documented
