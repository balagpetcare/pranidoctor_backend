# AI Core Platform — Phase 5 Hardening (Production GA Remediation)

**Project:** Prani Doctor  
**Role:** Principal Platform Reliability Architect  
**Date:** 2026-05-31  
**Status:** 5H.1–5H.5 implemented — 5H.6 GA sign-off pending  
**Version:** 1.0.0  
**Depends on:**

- `docs/plans/ai-phase-5-usage-analytics.md` (5.0–5.1 implemented)
- `docs/reports/ai-phase-5-analytics-verification.md`
- `docs/plans/ai-core-platform-phase-1-foundation.md`
- `docs/plans/AI_CONTROL_CENTER_RECOVERY_MASTER_PLAN.md`

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Scope guards, worker/cron, reconciliation, validation, security |
| `pranidoctor-web` | BFF passes scope context; no new analytics UI |
| `pranidoctor_user` | Out of scope — ensure usage dimensions emitted at request boundary only |

**Explicitly out of scope for this plan:**

- New analytics dashboards, charts, or summary metrics
- New rollup cube tables (Phase 5.4)
- Async export jobs (Phase 5.3 feature scope)
- Farmer-facing usage meters
- BI / warehouse integrations

---

## Executive summary

Phase 5.0–5.1 delivered **working analytics services** reading `AiUsageLog` and existing rollups. The [Phase 5 verification report](../reports/ai-phase-5-analytics-verification.md) scored **84/100 production readiness** with three **GA blockers**:

1. **No tenant scope enforcement** — any admin with `ai.analytics.view` can pass arbitrary `organizationId` / `branchId` query params (IDOR risk).
2. **Reconciliation jobs are callable but not scheduled** — rollups can drift silently in production.
3. **Inconsistent tenant dimensions at ingest** — org/branch often come from env config, not authenticated context.

**Phase 5 Hardening** closes these blockers and related reliability/security gaps **without adding analytics features**. It delivers:

- Organization and branch **scope guards** on every analytics read path
- **Worker + BullMQ cron** registration for daily/monthly reconciliation
- **Rollup validation** with drift detection and operational alerts
- **Security hardening** (IDOR prevention, audit, export scope, rate limits)
- **Data-path consistency** (logs-only reports, optional legacy write kill switch)

**Target outcome:** Analytics plane approved for **production GA** at ≥ **92/100** readiness per verification rubric.

---

## GA blocker inventory

| ID | Blocker | Severity | Current state | Hardening track |
|----|---------|----------|---------------|-----------------|
| B1 | No organization scope guard | **P0** | Query params trusted | H1 |
| B2 | No branch scope guard | **P0** | Query params trusted | H1 |
| B3 | Worker has zero job processors | **P0** | `worker.ts` line 73 | H2 |
| B4 | No cron for analytics jobs | **P0** | Jobs exist, not scheduled | H2 |
| B5 | No rollup drift validation | **P1** | Reconcile only on manual invoke | H3 |
| B6 | `AiUsageReportService` falls back to legacy records | **P1** | Dual read path | H4 |
| B7 | Dual-write to `AiUsageRecord` at ingest | **P1** | Storage + consistency debt | H4 |
| B8 | `tenantId` / org / branch incomplete on logs | **P1** | Env bootstrap only | H4 |
| B9 | No reconciliation run audit trail | **P2** | Logs only | H3 |
| B10 | `ORG_ADMIN` / `BRANCH_ADMIN` roles not in schema | **P2** | Plan-only roles | H1 (membership model) |

---

## Current state (post 5.0–5.1)

### What works

| Area | Artifact | Maturity |
|------|----------|----------|
| Summary APIs | 5 endpoints + legacy dashboard routes | Production code |
| Query source | `AiUsageLog` + `AiUsageDailyRollup` / `AiUsageMonthlyRollup` | Canonical read path |
| Aggregator | `AiMetricsAggregatorService.reconcileDailyMetrics/Monthly` | Unit tested |
| Job functions | `runDailyMetricsJob`, `runMonthlyMetricsJob` | Callable, not wired |
| Auth capability | `ai.analytics.view`, `ai.analytics.export` | SUPER_ADMIN + ADMIN |
| Queue infra | BullMQ `SCHEDULED` queue + `scheduleRepeatingJob` | Available, unused by AI analytics |
| Worker process | Redis + Prisma + queue connection | **No processors registered** |

### Critical gaps

| Gap | Risk |
|-----|------|
| `UserRole` enum has only `ADMIN` / `SUPER_ADMIN` — no `ORG_ADMIN` / `BRANCH_ADMIN` | Scope guards cannot rely on role enum alone |
| `AdminProfile` has no `organizationId` / `branchId` | No DB-backed admin tenancy |
| Analytics routes parse filters from URL without actor scope injection | **Cross-tenant IDOR** |
| Hot-path rollup upsert can fail silently (logged, not repaired automatically) | Dashboard drift |
| No `freshness` or `reconciliationStatus` in API responses | Ops blind spot |

---

## Hardening principles

| Principle | Interpretation |
|-----------|----------------|
| **Fail closed on read** | Scope violation → 403 before any DB query |
| **No feature expansion** | Same endpoints, same response shapes; add `scope` + `freshness` metadata only |
| **Reuse existing infra** | BullMQ `SCHEDULED` queue, existing aggregator, existing rollups |
| **No duplicate fact storage** | Validation compares logs ↔ rollups; no third analytics table for facts |
| **Idempotent jobs** | Reconciliation safe to retry; use jobId dedupe |
| **Observable reliability** | Every scheduled run → structured log + reconciliation record + metric |
| **Single-tenant GA first** | Platform ADMIN = full platform scope until membership rows exist |
| **Prepare enterprise** | Membership schema + guard hooks ready before ORG/BRANCH roles go live |

---

## Remediation architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Admin API request                                                       │
│  GET /api/admin/ai-ops/analytics/usage/*?organizationId=&branchId=       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  requireAiAdminCapability('ai.analytics.view')                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AiUsageScopeGuard.resolve(actor, rawFilters)  ← NEW (H1)               │
│  • SUPER_ADMIN → pass-through (optional scope filter)                    │
│  • ADMIN (platform) → strip foreign org/branch params                    │
│  • ORG member → force organizationId; optional branch filter in org      │
│  • BRANCH member → force branchId (+ org)                                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Existing analytics services (unchanged feature logic)                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Worker bootstrap (H2)                                                   │
│  • createWorker(SCHEDULED, aiAnalyticsJobProcessor)                      │
│  • scheduleRepeatingJob — daily 02:05 UTC, monthly 1st 03:15 UTC         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AiMetricsAggregatorService (existing)                                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  AiRollupValidationService.validate(bucket)  ← NEW (H3)                  │
│  • Compare log sums vs rollup sums (±ε)                                  │
│  • Persist AiAnalyticsReconciliationRun                                    │
│  • Alert via AiUsageAlert on drift                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Priority 1 — Organization scope guards

### Problem

Any authenticated admin can request `?organizationId=foreign-org` and receive aggregated data if matching log rows exist. There is **no server-side binding** between admin actor and organization.

### Remediation (H1.1)

**New module:** `src/modules/ai/analytics/security/`

| File | Responsibility |
|------|----------------|
| `ai-usage-scope.types.ts` | `AnalyticsScopeLevel`, `ResolvedAnalyticsScope`, `ScopeGuardResult` |
| `ai-usage-scope.resolver.ts` | Map actor → allowed scope |
| `ai-usage-scope.guard.ts` | `enforceScope(actor, filters) → filters \| 403` |

**Scope resolution rules (v1 — single-tenant GA):**

| Actor | Allowed scope | Query param behavior |
|-------|---------------|---------------------|
| `SUPER_ADMIN` | Platform + any org/branch | Pass-through all filters |
| `ADMIN` | Platform only | **Reject** `organizationId` / `branchId` not matching platform env OR membership |
| Future org member | Single `organizationId` | **Force** `organizationId`; ignore/spoof attempts → 403 |
| Future branch member | Single `branchId` within org | **Force** both IDs |

**Platform ADMIN v1 behavior (until membership table populated):**

- If `organizationId` or `branchId` query params present **and** they differ from `AiPlatformConfig.organizationId` / `branchId` (when env set) → **403 `SCOPE_FORBIDDEN`**
- If env org/branch unset (dev) → **strip** org/branch params from filters (platform-wide only) and log warning once per request

### Remediation (H1.2) — Membership schema (minimal, no feature expansion)

Add **admin scope membership** — not full RBAC product:

```prisma
model AdminAnalyticsScope {
  id             String   @id @default(cuid())
  userId         String
  scopeLevel     String   @db.VarChar(16)  // platform | organization | branch
  organizationId String?  @db.VarChar(64)
  branchId       String?  @db.VarChar(64)
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, scopeLevel, organizationId, branchId])
  @@index([userId, enabled])
  @@map("admin_analytics_scopes")
}
```

- Seed: all existing `SUPER_ADMIN` users → `scopeLevel=platform`
- Seed: all existing `ADMIN` users → `scopeLevel=platform` (same as today)
- **Do not** add `ORG_ADMIN` to `UserRole` enum in this phase — scope level lives on membership row

### Integration points (all analytics routes)

Apply `enforceScope` in **one** place:

```typescript
// ai-admin-route.util.ts — extend parseAnalyticsFiltersFromRequest
export async function parseScopedAnalyticsFilters(
  request: Request,
  actor: AiAdminActor,
): Promise<UsageAnalyticsFilters | Response> {
  const raw = parseAnalyticsFiltersFromRequest(request);
  return getAiUsageScopeGuard().enforce(actor, raw);
}
```

**Routes to wire (12 paths):**

- `summary`, `cost-summary`, `provider-summary`, `model-summary`, `performance-summary`
- `dashboard`, `daily-cost`, `monthly-cost`, `providers`, `features`, `trends`, `report`

### Acceptance criteria (H1)

| ID | Criterion |
|----|-----------|
| H1-V1 | ADMIN requesting foreign `organizationId` receives 403 |
| H1-V2 | SUPER_ADMIN can query any org/branch |
| H1-V3 | Scope enforcement runs **before** Prisma in all 12 routes |
| H1-V4 | Unit tests: platform admin, super admin, org member, branch member, spoof attempt |
| H1-V5 | Audit log entry on scope violation (`AI_ANALYTICS_SCOPE_DENIED`) |

---

## Priority 2 — Branch scope guards

### Problem

Branch is a finer slice of organization. Even with org guard, a branch-level actor could read sibling branch data without branch enforcement.

### Remediation (H1.3) — Branch rules in same guard

| Scope level | `branchId` filter | `organizationId` filter |
|-------------|-----------------|-------------------------|
| `platform` | Optional (super only) or stripped (admin) | Optional (super only) or stripped |
| `organization` | Optional **within** org (any branch in org) | Forced to membership org |
| `branch` | Forced to membership branch | Forced to parent org |

**Branch ⊆ org invariant:** Guard validates `branchId` belongs to `organizationId` via static config map or future `Branch` registry. Until branch registry exists:

- Store both IDs on `AdminAnalyticsScope` row
- Validation: membership row must have both set when `scopeLevel=branch`
- Cross-check log queries never return rows where `log.branchId ≠ forced branchId`

### Branch admin read restrictions (existing plan, enforced not built)

Branch-scoped actors **must not** receive:

- Provider-level pricing metadata beyond aggregate cost (already in plan — enforce in export column filter later; **read** paths unchanged in hardening except scope)

For hardening: **same APIs**, scope guard truncates visibility — no new endpoints.

### Acceptance criteria (H2)

| ID | Criterion |
|----|-----------|
| H2-V1 | Branch member querying sibling `branchId` → 403 |
| H2-V2 | Org member can list all branches in org (no branch filter) but not other orgs |
| H2-V3 | Branch member forced filters applied even when query params omitted |
| H2-V4 | Integration test: logs for branch A not visible to branch B actor |

---

## Priority 3 — Worker integration

### Problem

`src/worker.ts` initializes Redis and queues then exits idle — **no `createWorker` registrations**. Analytics jobs never run in production worker process.

### Remediation (H2.1)

**New module:** `src/modules/ai/analytics/jobs/ai-analytics-worker.bootstrap.ts`

Responsibilities:

1. Import after `initializeQueueConnection(config)`
2. `createWorker(QueueNames.SCHEDULED, processAiAnalyticsScheduledJob)`
3. Register graceful shutdown hook (existing `closeAllQueues`)

**Job processor dispatch:**

| Job name | Handler |
|----------|---------|
| `ai.analytics.reconcile.daily` | `runDailyMetricsJob()` |
| `ai.analytics.reconcile.monthly` | `runMonthlyMetricsJob()` |
| `ai.analytics.validate.daily` | `runDailyRollupValidationJob()` |

**Worker registration in `worker.ts`:**

Replace log line *"No job processors registered yet"* with:

```typescript
const { bootstrapAiAnalyticsWorkers } = await import('./modules/ai/analytics/jobs/ai-analytics-worker.bootstrap.js');
await bootstrapAiAnalyticsWorkers(config);
```

**Concurrency:** Use `queueDefinitions[SCHEDULED].workerOptions.concurrency` (5) — analytics reconcile jobs are DB-heavy; set **concurrency: 1** for analytics processor via named worker or dedicated queue if job interference is a concern.

**Recommendation:** Add dedicated queue name `AI_ANALYTICS` to `QueueNames` (config only, not a feature — operational isolation):

```typescript
AI_ANALYTICS: 'ai:analytics',
```

Worker options: `concurrency: 1`, `attempts: 3`, exponential backoff.

### Acceptance criteria (H3)

| ID | Criterion |
|----|-----------|
| H3-V1 | Worker startup logs `AI analytics worker registered` |
| H3-V2 | Manual job enqueue processed end-to-end in staging |
| H3-V3 | Worker shutdown closes analytics worker without hang |
| H3-V4 | Job failure surfaces in queue metrics (`recordQueueJob`) |

---

## Priority 4 — Cron integration

### Problem

`scheduleRepeatingJob` exists but analytics never calls it. Ops would need manual invocation or external cron curl.

### Remediation (H2.2)

Register repeating jobs **once** at worker bootstrap (idempotent jobId):

| Job | Cron (UTC) | Rationale |
|-----|------------|-----------|
| `ai.analytics.reconcile.daily` | `5 2 * * *` | 02:05 — after UTC day close, before validation |
| `ai.analytics.validate.daily` | `30 2 * * *` | 02:30 — after reconcile completes |
| `ai.analytics.reconcile.monthly` | `15 3 1 * *` | 03:15 on 1st — previous month closed |

**Implementation:**

```typescript
await scheduleRepeatingJob(
  QueueNames.AI_ANALYTICS,
  'ai.analytics.reconcile.daily',
  { source: 'cron' },
  '5 2 * * *',
  { jobId: 'ai-analytics-daily-reconcile' },
);
```

Use stable `jobId` to prevent duplicate repeat entries on worker restart (BullMQ dedupe).

**Environment gates:**

| Env var | Default | Purpose |
|---------|---------|---------|
| `AI_ANALYTICS_CRON_ENABLED` | `true` in production | Kill switch |
| `AI_ANALYTICS_RECONCILE_ENABLED` | `true` | Disable reconcile only |
| `AI_ANALYTICS_VALIDATE_ENABLED` | `true` | Disable validation only |

### Fallback: external cron (documented)

For environments without always-on worker, provide ops script:

```
npm run ops:ai-analytics-reconcile -- --date=2026-05-30
```

Script invokes same job functions — **not** a separate code path.

### Acceptance criteria (H4)

| ID | Criterion |
|----|-----------|
| H4-V1 | Repeating jobs visible in Redis/BullMQ after worker start |
| `H4-V2` | `AI_ANALYTICS_CRON_ENABLED=false` skips registration |
| H4-V3 | Staging run completes daily job within 10 min for ≤100k log rows/day |

---

## Priority 5 — Analytics job scheduling

### Problem

Hot-path rollup upsert and nightly reconcile can race; no orchestration metadata.

### Remediation (H2.3)

**Job scheduling policy:**

| Trigger | Job | Priority |
|---------|-----|----------|
| Cron | Daily reconcile (yesterday) | P0 |
| Cron | Daily validate (yesterday) | P0 |
| Cron | Monthly reconcile (previous month) | P0 |
| Hot-path failure | Repair event → optional delayed job | P1 |
| Manual SUPER_ADMIN | `POST /api/admin/ai-ops/analytics/reconciliation/run` | P2 (exists in plan — wire with scope + audit) |

**Repair queue (optional H2.3b):**

On rollup upsert failure in `AiUsageService.persistAttempt`, push:

```typescript
{ type: 'repair-bucket', bucketDate, dimension: 'platform' }
```

With debounce key `repair:{bucketDate}` — max one repair job per bucket per 5 min.

**No new user-facing features** — repair is background only.

### Acceptance criteria (H5)

| ID | Criterion |
|----|-----------|
| H5-V1 | Daily cron runs before validate cron (schedule order) |
| H5-V2 | Repair job idempotent with reconcile |
| H5-V3 | Overlapping manual + cron run safe (same bucket overwrite) |

---

## Priority 6 — Metrics reconciliation

### Problem

Reconciliation exists but lacks run history, alerting, and manual visibility.

### Remediation (H3.1)

**Extend** `AiMetricsAggregatorService` (no new aggregator):

| Method | Purpose |
|--------|---------|
| `reconcileDailyMetrics` | Existing — add return field `driftDetected: boolean` after validation |
| `getLastReconciliationRun(type)` | Read from persistence |

**New persistence (operational, not fact storage):**

```prisma
model AiAnalyticsReconciliationRun {
  id              String   @id @default(cuid())
  runType         String   @db.VarChar(32)   // daily | monthly | validate
  bucketKey       String   @db.VarChar(32)   // 2026-05-30 or 2026-05
  status          String   @db.VarChar(16)   // success | failed | drift
  logCount        Int      @default(0)
  rollupsUpserted Int      @default(0)
  driftUsd        Decimal? @db.Decimal(12, 6)
  driftRequests   Int?
  durationMs      Int
  errorMessage    String?  @db.Text
  metadataJson    Json?
  startedAt       DateTime @default(now())
  completedAt     DateTime?

  @@index([runType, bucketKey])
  @@index([status, startedAt])
  @@map("ai_analytics_reconciliation_runs")
}
```

**Alert integration:** On `status=drift` or `failed`, call existing `AiUsageAlertService` with `alertType=ANALYTICS_RECONCILE_DRIFT`.

### Remediation (H3.2) — API freshness metadata (non-breaking)

Add optional fields to summary envelope (existing plan shape):

```typescript
freshness: {
  lastDailyReconcileAt: string | null;
  lastValidateAt: string | null;
  lagSeconds: number | null;
}
```

Same data source: latest `AiAnalyticsReconciliationRun` — **metadata only**, not a new analytics feature.

### Acceptance criteria (H6)

| ID | Criterion |
|----|-----------|
| H6-V1 | Every cron reconcile writes `AiAnalyticsReconciliationRun` |
| H6-V2 | Failed job persists `errorMessage` |
| H6-V3 | Drift triggers `AiUsageAlert` |

---

## Priority 7 — Rollup validation

### Problem

No automated check that `sum(AiUsageLog)` ≈ `sum(AiUsageDailyRollup)` for a bucket.

### Remediation (H3.3)

**New service:** `AiRollupValidationService`

```typescript
interface RollupValidationResult {
  bucketDate: string;
  logRequests: number;
  rollupRequests: number;
  logCostUsd: number;
  rollupCostUsd: number;
  logTokens: number;
  rollupTokens: number;
  driftRequests: number;
  driftCostUsd: number;
  withinTolerance: boolean;
}
```

**Algorithm (daily platform bucket):**

1. `fetchUsageLogsForBucket(dayStart, dayEnd)` → aggregate totals
2. `AiUsageDailyRollup.findMany({ bucketDate: dayStart })` → sum measures
3. Compare with tolerance:
   - `|driftCostUsd| ≤ 0.01` USD
   - `|driftRequests| ≤ 0` (exact match required)
4. On failure → `AiMetricsAggregatorService.reconcileDailyMetrics(dayStart)` **once** (auto-repair)
5. Re-validate; if still failing → alert + `status=drift`

**Monthly validation:** Sample platform dimension only (same pattern on `AiUsageMonthlyRollup` where `dimensionType=platform`).

**Branch/org validation (v1):** Log-only spot check for membership org — compare sum logs where `organizationId=X` vs monthly rollup rows for same dimension. **No new tables.**

### Acceptance criteria (H7)

| ID | Criterion |
|----|-----------|
| H7-V1 | Validation passes when hot-path and reconcile agree |
| H7-V2 | Validation detects intentional drift in test fixture |
| H7-V3 | Auto-repair fixes transient upsert failure |
| H7-V4 | Validation runtime < 60s for 100k logs/day (indexed `createdAt`) |

---

## Priority 8 — Security review

### Threat model (analytics plane)

| Threat | Vector | Mitigation (H4) |
|--------|--------|-----------------|
| **IDOR** | Spoofed `organizationId` / `branchId` | Scope guard (H1) |
| **Privilege escalation** | ADMIN reads platform-wide | Strip params / membership |
| **Data exfiltration** | Large CSV export | Existing 10k cap + scope on export |
| **Recon enumeration** | User ID lookup | Scope guard on `userId` filter |
| **DoS** | Wide date range queries | Max `sinceDays=365` (existing) + rate limit |
| **Audit gap** | Unlogged exports | Audit all exports (existing plan — wire) |

### Remediation (H4.1) — Security hardening tasks

| Task | Detail |
|------|--------|
| **S1** | Centralize filter parsing through `parseScopedAnalyticsFilters` |
| **S2** | Reject `userId` filter unless actor is SUPER_ADMIN or org/branch admin with user in scope |
| **S3** | `generateReport` — remove `AiUsageRecord` fallback; logs-only (B6) |
| **S4** | Export route: apply scope guard + `AiPlatformAuditService.log('analytics.export')` |
| **S5** | Rate limit: 60 req/min per admin user on analytics routes (existing middleware pattern) |
| **S6** | Structured log on every scope denial with actor id, requested scope, route |
| **S7** | Security test suite: IDOR matrix (12 routes × 4 actor types) |

### Remediation (H4.2) — Ingest hardening (supports accurate scoped analytics)

| Task | Detail |
|------|--------|
| **I1** | Middleware: attach `organizationId`, `branchId`, `tenantId` to AI request context from auth (not env) |
| **I2** | `resolveUsageDimensions()` prefers request context over env |
| **I3** | Feature flag `AI_USAGE_LEGACY_WRITE=false` stops `AiUsageRecord` dual-write |
| **I4** | Monitor: alert if any write to `AiUsageRecord` when flag false |

**Note:** I1–I4 are **consistency hardening**, not new analytics features.

### Security review checklist (sign-off gate)

| # | Check | Owner | Pass |
|---|-------|-------|------|
| 1 | All analytics routes use scope guard | Backend | ☐ |
| 2 | IDOR test matrix green | QA | ☐ |
| 3 | Export audit logged | Backend | ☐ |
| 4 | No legacy record fallback in reports | Backend | ☐ |
| 5 | Cron jobs run as system actor (no user session) | Platform | ☐ |
| 6 | Reconciliation API SUPER_ADMIN only | Backend | ☐ |
| 7 | Pen test: parameter tampering on all 12 routes | Security | ☐ |
| 8 | Secrets not in analytics `metadataJson` | Backend | ☐ |

---

## Sub-phases & delivery roadmap

| Sub-phase | Scope | Priority | Depends on |
|-----------|-------|----------|------------|
| **5H.1** | Scope types, guard, membership schema, route wiring | P0 | — |
| **5H.2** | `AI_ANALYTICS` queue, worker bootstrap, cron registration | P0 | — |
| **5H.3** | Reconciliation run table, validation service, auto-repair | P1 | 5H.2 |
| **5H.4** | Report logs-only, legacy write flag, ingest context | P1 | 5H.1 |
| **5H.5** | Freshness metadata, reconciliation status API, ops script | P2 | 5H.3 |
| **5H.6** | Security test matrix, verification report update, GA sign-off | P0 | 5H.1–5H.4 |

### Implementation progress

| Sub-phase | Status |
|-----------|--------|
| 5H.1 – Scope guards + membership schema + route wiring | **Done** |
| 5H.2 – AI_ANALYTICS queue + worker bootstrap + cron | **Done** |
| 5H.3 – Reconciliation run table + drift alerts + freshness | **Done** |
| 5H.4 – Rollup validation + auto-repair + logs-only reports | **Done** |
| 5H.5 – Export audit + rate limits + IDOR tests + ops script | **Done** |
| 5H.6 – Security test matrix + verification report + GA sign-off | **Partial** — report done; GA-3/GA-7 pending |

---

## Module structure (planned)

```
src/modules/ai/analytics/
├── security/                          # NEW — H1
│   ├── ai-usage-scope.types.ts
│   ├── ai-usage-scope.resolver.ts
│   ├── ai-usage-scope.guard.ts
│   └── ai-usage-scope.guard.test.ts
├── validation/                        # NEW — H3
│   ├── ai-rollup-validation.service.ts
│   ├── ai-rollup-validation.types.ts
│   └── ai-rollup-validation.test.ts
├── jobs/
│   ├── ai-daily-metrics.job.ts        # existing
│   ├── ai-monthly-metrics.job.ts      # existing
│   ├── ai-daily-validation.job.ts     # NEW
│   ├── ai-analytics-worker.bootstrap.ts  # NEW — H2
│   └── ai-analytics-job.types.ts
├── metrics/                           # existing — extend freshness reader
└── usage/
    └── ai-usage-report.service.ts     # MODIFY — logs-only (H4)
```

**Schema migration:** `20260609120000_ai_phase5_hardening` — `AdminAnalyticsScope`, `AiAnalyticsReconciliationRun` only.

**Ops script:** `scripts/ops/ai-analytics-reconcile.mjs`

---

## Reporting APIs (hardening only)

| Method | Path | Change |
|--------|------|--------|
| GET | `/analytics/reconciliation/status` | **Wire** — SUPER_ADMIN, reads `AiAnalyticsReconciliationRun` |
| POST | `/analytics/reconciliation/run` | **Wire** — SUPER_ADMIN, manual trigger with audit |
| GET | `/* summary routes` | Add `freshness` block; scope enforced |

No new analytics metrics or breakdowns.

---

## Verification & GA gates

### Pre-GA test plan

```bash
npx vitest run src/modules/ai/analytics
npx vitest run src/modules/ai
npm run typecheck:ai
# Staging:
npm run worker:dev   # verify cron registration
npm run ops:ai-analytics-reconcile -- --date=yesterday
```

### GA readiness targets (post-hardening)

| Dimension | Current | Target |
|-----------|--------:|-------:|
| Production readiness | 84 | **≥ 92** |
| Accuracy | 88 | **≥ 90** |
| Technical debt | 58 | **≤ 40** |
| Security (analytics) | Partial | **Pass checklist** |

### GA sign-off criteria

| ID | Gate |
|----|------|
| GA-1 | All H1–H7 acceptance criteria pass |
| GA-2 | Security checklist 8/8 pass |
| GA-3 | 7 consecutive days cron success in staging |
| GA-4 | Zero scope guard bypass in IDOR test matrix |
| GA-5 | Rollup validation drift rate < 0.1% of days |
| GA-6 | Verification report updated with ≥ 92 readiness |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| ORG/BRANCH roles delayed | Membership table decouples scope from `UserRole` enum |
| Worker not deployed in some envs | Ops script + external cron docs |
| Reconcile load on large log table | Half-open bucket query + index on `createdAt`; concurrency 1 |
| Auto-repair masks systemic bug | Alert on second validation failure after repair |
| Breaking ADMIN workflows that used org params | Document platform-only ADMIN; SUPER_ADMIN for cross-org |

---

## Out of scope (explicit)

- Phase 5.2 role dashboards / new UI pages
- Phase 5.3 async export jobs
- Phase 5.4 new daily cube tables
- Phase 5.5 scheduled email reports
- `ORG_ADMIN` / `BRANCH_ADMIN` as `UserRole` enum values (use membership instead)
- New Prometheus dashboards (optional metric counters only)

---

## Summary

Phase 5 Hardening closes **production GA blockers** for the AI Analytics module by enforcing **organization and branch scope** on every read path, registering **worker and cron** reconciliation, adding **rollup validation with drift repair**, and completing a **security review** with IDOR prevention and logs-only reporting — **without expanding analytics features**.

**Execution order:** 5H.1 (scope guards) → 5H.2 (worker/cron) → 5H.3 (validation) → 5H.4 (data-path consistency) → 5H.5 (ops visibility) → 5H.6 (GA sign-off).

**Canonical reliability flow:** Cron → Reconcile logs → rollups → Validate → Record run → Alert on drift → API freshness metadata.

**No implementation** is included in this document.
