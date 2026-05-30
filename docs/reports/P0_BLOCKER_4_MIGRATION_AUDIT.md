# P0 BLOCKER-4 — AI Platform Migration Audit

**Date:** 2026-05-30  
**Migration:** `20260602120000_ai_production_platform`  
**Status:** **DEPLOY-SAFE (local verified; staging/production pending host run)**

---

## Executive summary

Migration `20260602120000_ai_production_platform` is **additive and idempotent**. It introduces three new AI platform tables, four nullable dimension columns on `AiUsageRecord`, and seven indexes. No data is dropped or rewritten. Rollback is **forward-only** (app revert or backup restore). Local `npm run db:migrate:deploy` reports **no pending migrations**; schema, indexes, and CRUD probes all pass.

---

## 1. Migration audit

### SQL summary (`prisma/migrations/20260602120000_ai_production_platform/migration.sql`)

| Step | Operation | Risk |
|------|-----------|------|
| 1–4 | `ALTER TABLE AiUsageRecord ADD COLUMN IF NOT EXISTS` (org/branch/clinic/doctor) | **P3** — nullable, no backfill required |
| 5–6 | `CREATE INDEX IF NOT EXISTS` on `AiUsageRecord` | **P3** — may lock on large tables |
| 7–39 | `CREATE TABLE IF NOT EXISTS AiUsageMonthlyRollup` + indexes | **P3** — new empty table |
| 41–53 | `CREATE TABLE IF NOT EXISTS AiProviderHealthSnapshot` + index | **P3** — new empty table |
| 55–71 | `CREATE TABLE IF NOT EXISTS AiUsageAlert` + indexes | **P3** — new empty table |

**Safety classifier** (`scripts/db/lib/migration-safety.mjs`):

- **maxSeverity:** P3 (index creation only)
- **nonReversible:** `false` (no DROP TABLE/COLUMN, no DELETE, no type changes)
- **Idempotent:** All DDL uses `IF NOT EXISTS`

### Prisma schema alignment

| Model | Matches migration | Notes |
|-------|-------------------|-------|
| `AiUsageRecord` | Yes | 4 new optional `@db.VarChar(64)` columns + 2 indexes |
| `AiUsageMonthlyRollup` | Yes | Unique on `(bucketMonth, dimensionType, dimensionId, provider, model)` |
| `AiProviderHealthSnapshot` | Yes | Append-only probe log |
| `AiUsageAlert` | Yes | JSONB metadata, acknowledged flag |

`npm run db:audit` — **59 migrations**, Prisma validate **OK**.

---

## 2. Rollback safety

Prisma migrations are **forward-only**. There is no automated `migrate down`.

### Rollback options

| Scenario | Action |
|----------|--------|
| App bug after deploy, schema OK | Redeploy previous API image |
| Migration failed mid-deploy | Stop traffic; fix forward or restore backup |
| Must undo schema | Restore pre-migrate PostgreSQL backup |

### Manual schema reversal (emergency only)

```sql
-- Only after app stopped and backup confirmed unnecessary
DROP TABLE IF EXISTS "AiUsageAlert";
DROP TABLE IF EXISTS "AiProviderHealthSnapshot";
DROP TABLE IF EXISTS "AiUsageMonthlyRollup";
DROP INDEX IF EXISTS "AiUsageRecord_doctorId_createdAt_idx";
DROP INDEX IF EXISTS "AiUsageRecord_organizationId_createdAt_idx";
ALTER TABLE "AiUsageRecord" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "AiUsageRecord" DROP COLUMN IF EXISTS "branchId";
ALTER TABLE "AiUsageRecord" DROP COLUMN IF EXISTS "clinicId";
ALTER TABLE "AiUsageRecord" DROP COLUMN IF EXISTS "doctorId";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260602120000_ai_production_platform';
```

**Risk:** Loses all rows in the three new tables. Existing `AiUsageRecord` rows retain data; dimension columns dropped.

### Backup infrastructure

| Asset | Status |
|-------|--------|
| `scripts/backup/postgres-backup.sh` | Present |
| `scripts/backup/postgres-restore.sh` | Present |
| Staging deploy workflow | Runs backup before migrate |
| Production deploy workflow | Requires backup before migrate |

---

## 3. Staging deployment verification

### CI/CD path (`.github/workflows/deploy-staging.yml`)

1. `validate:production-env` with `REDIS_ENABLED=true`
2. Build + push Docker image
3. Remote deploy (when enabled):
   - `./scripts/backup/postgres-backup.sh`
   - `ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy`
   - `docker compose up -d api`
   - Poll `GET /ready` (30 attempts)

### Local / staging host status

| Check | Result |
|-------|--------|
| Migration in `_prisma_migrations` | **Applied** `2026-05-30T16:01:07Z` |
| `npm run db:migrate:deploy` (local) | **No pending migrations** |
| Live staging host | **Not verified in this audit** — run checklist §10 on staging |

---

## 4. Production deployment verification

### CI/CD path (`.github/workflows/deploy-production.yml`)

1. Env schema validation
2. Pre-deploy backup reminder
3. Remote deploy (when enabled):
   - Mandatory `postgres-backup.sh`
   - `ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy`
   - `curl /ready`

### Production guard (`scripts/prisma-production-guard.mjs`)

- Blocks migrate when `DATABASE_URL` host looks like production **unless** `ALLOW_PRODUCTION_MIGRATE=true`
- Blocks `NODE_ENV=production` with localhost DB host

### Production host status

| Check | Result |
|-------|--------|
| Live production migrate | **Not verified in this audit** — requires operator run |

---

## 5. Index verification

### Expected vs actual (local PostgreSQL)

| Index | Status |
|-------|--------|
| `AiUsageRecord_doctorId_createdAt_idx` | Present |
| `AiUsageRecord_organizationId_createdAt_idx` | Present |
| `AiUsageMonthlyRollup_bucketMonth_dimensionType_idx` | Present |
| `AiUsageMonthlyRollup_dimensionType_dimensionId_bucketMonth_idx` | Present |
| `AiUsageMonthlyRollup` unique composite | Present (truncated name — see note) |
| `AiProviderHealthSnapshot_provider_probedAt_idx` | Present |
| `AiUsageAlert_alertType_createdAt_idx` | Present |
| `AiUsageAlert_acknowledged_createdAt_idx` | Present |

**Note:** PostgreSQL truncates identifiers to **63 characters**. The unique index appears as:

`AiUsageMonthlyRollup_bucketMonth_dimensionType_dimensionId_prov`

Functionally equivalent to the Prisma-declared name. Upsert on `bucketMonth_dimensionType_dimensionId_provider_model` **works** (verified).

---

## 6. Data integrity verification

### Existing data impact

| Area | Impact |
|------|--------|
| `AiUsageRecord` existing rows | **Unchanged** — new columns NULL until new usage |
| Daily rollups | **Unchanged** — separate tables |
| Other tables | **No FK additions** — no cascade risk |

### Integrity probe (`npx tsx scripts/db/verify-ai-migration.mjs`)

| Probe | Result |
|-------|--------|
| Insert `AiUsageRecord` with org/doctor dimensions | **PASS** |
| Monthly rollup upsert (platform/global) | **PASS** |
| Health snapshot insert | **PASS** |
| Alert insert + JSON metadata | **PASS** |
| Cleanup (probe rows deleted) | **PASS** |

---

## 7. Monthly rollups verification

### Application path

`AiUsageService.persistAttempt()` (`src/modules/ai/usage/ai-usage.service.ts`):

1. Inserts `AiUsageRecord` with resolved dimensions
2. Upserts `AiUsageDailyRollup` (existing)
3. Upserts `AiUsageMonthlyRollup` for each dimension:
   - `platform/global`
   - `organization/{id}`, `branch/{id}`, `clinic/{id}`, `doctor/{id}` (when resolved)

### Schema ↔ code contract

| Field | Migration | App (`buildMonthlyRollupFields`) |
|-------|-----------|-----------------------------------|
| `bucketMonth` | DATE, UTC month start | `utcBucketMonth()` |
| `dimensionType` | VARCHAR(32) | `platform`, `organization`, etc. |
| `dimensionId` | VARCHAR(64) nullable | Always string (`global` or ID) |
| `costUsd` | DECIMAL(12,6) | Incremented per attempt |
| `latencyMsSum`, `timeoutCount` | Present | Updated on each attempt |

### Known design note

PostgreSQL treats `NULL` as distinct in unique indexes. The app **never upserts with `dimensionId: null`** — platform uses `'global'`. No integrity issue under current code paths.

---

## 8. Health snapshots verification

### Application path

`persistSnapshot()` in `src/modules/ai/health/ai-health-probe.service.ts`:

- Creates row on each probe when `persist: true`
- Fields: `provider`, `reachable`, `latencyMs`, `errorCode`, `probedAt`

### Query pattern

- Index `(provider, probedAt)` supports latest-by-provider admin queries
- Table is **append-only** (no updates) — safe for high probe frequency

### Probe result

Insert + read **PASS** in integrity script.

---

## 9. Alerts persistence verification

### Application path

`AiUsageAlertService.persistAlert()` (`src/modules/ai/alerts/ai-usage-alert.service.ts`):

| Alert type | Trigger | Persisted fields |
|------------|---------|------------------|
| `budget_exceeded` | Budget service | severity `critical`, metadata = budget status |
| `provider_unavailable` | Health probe | severity `warning`, metadata = provider status |
| `usage_spike` | Usage service | severity `warning`, metadata = ratio/counts |

- In-memory cooldown (15 min) prevents duplicate **emits**; DB retains history
- `listRecent()` used by admin platform API

### Probe result

Insert with `metadataJson` **PASS**; indexes support `alertType + createdAt` and `acknowledged + createdAt` filters.

---

## 10. Deployment checklist

### Pre-deploy (staging & production)

- [ ] Confirm migration `20260602120000_ai_production_platform` is in release branch
- [ ] Run `npm run db:audit` — Prisma validate OK
- [ ] Run `npm test` — AI platform tests pass
- [ ] Take PostgreSQL backup (`scripts/backup/postgres-backup.sh`)
- [ ] Confirm `DATABASE_URL` points to target environment
- [ ] Confirm `REDIS_ENABLED=true` (required for rate limits post-deploy)

### Deploy

- [ ] Set `ALLOW_PRODUCTION_MIGRATE=true` (production/staging managed hosts)
- [ ] Run `npm run db:migrate:deploy`
- [ ] Verify output: `Applying migration 20260602120000_ai_production_platform` **or** `No pending migrations`
- [ ] Deploy API + worker images
- [ ] Run `npx tsx scripts/db/verify-ai-migration.mjs` on target DB (optional but recommended)

### Post-deploy smoke

- [ ] `GET /ready` → 200
- [ ] `GET /health/db` → healthy
- [ ] `GET /health/redis` → healthy (production)
- [ ] Trigger one AI request (or wait for health probe cycle)
- [ ] Confirm row in `AiUsageRecord` (if traffic exists)
- [ ] Confirm `AiProviderHealthSnapshot` rows when `AI_HEALTH_PROBE_ENABLED=true`
- [ ] Check admin AI ops endpoints return 200 for authenticated admin

### Rollback (if needed)

- [ ] Stop API/worker traffic
- [ ] Redeploy previous image **or** restore DB from pre-migrate backup
- [ ] Verify `/ready` and core auth flows

---

## 11. Validation commands run

| Command | Result |
|---------|--------|
| `npm run db:migrate:deploy` | **PASS** — no pending migrations (local) |
| `npm run db:audit` | **PASS** — 59 migrations, schema valid |
| `npx tsx scripts/db/verify-ai-migration.mjs` | **PASS** — tables, indexes, CRUD probes |

---

## 12. Findings & recommendations

| ID | Severity | Finding | Recommendation |
|----|----------|---------|----------------|
| F1 | Info | Unique index name truncated by PG 63-char limit | Documented; no action required |
| F2 | Low | `CREATE INDEX` on `AiUsageRecord` may lock if table is large | Run migrate in maintenance window if millions of rows |
| F3 | Info | Staging/production hosts not migrated in this session | Execute §10 checklist on each environment |
| F4 | Info | No automated rollback migration | Rely on backup restore per `docs/database/rollback-procedures.md` |
| F5 | Low | Consider shortening Prisma unique index name in future migration | Optional cosmetic fix |

---

## 13. Conclusion

**P0 BLOCKER-4 — deploy-safe for release.** The migration is additive, idempotent, schema-aligned, and functionally verified locally. Staging and production deployment paths are documented in CI workflows with backup + guarded migrate. **Operator action required:** run the deployment checklist on staging and production hosts before GA sign-off.

**Verification tool:** `npx tsx scripts/db/verify-ai-migration.mjs`
