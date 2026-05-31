# AI Core Platform — Phase 5 Usage Analytics

**Project:** Prani Doctor  
**Role:** Principal AI Analytics Architect  
**Date:** 2026-05-31  
**Status:** Phase 5.0–5.1 implemented — 2026-05-31  
**Version:** 1.1.0  
**Depends on:**

- `docs/plans/ai-core-platform-phase-1-foundation.md` (implemented)
- `docs/plans/ai-phase-2-provider-management.md` (implemented)
- `docs/plans/ai-phase-3-model-registry.md` (partial — 3.0–3.1 done)
- `docs/plans/ai-phase-4-router-engine.md` (partial — 4.0–4.1 done)
- `docs/reports/ai-foundation-verification.md`
- `docs/reports/ai-router-verification.md`
- `docs/reports/ai-model-registry-verification.md`

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Usage ingestion, rollups, analytics services, reporting APIs, scheduled aggregation |
| `pranidoctor-web` | AI Control Center — role-scoped analytics dashboards, export UX, BFF proxies |
| `pranidoctor_user` | Consumer only — usage dimensions emitted via orchestrator context; no analytics UI |

**Related documents:**

- `docs/plans/AI_CONTROL_CENTER_RECOVERY_MASTER_PLAN.md`
- `docs/plans/ai-core-platform-phase-1-foundation.md` § AiUsageLog
- `pranidoctor-web/docs/ai/COST_OPTIMIZATION.md` § Cost Tracking
- `pranidoctor-web/docs/database/MULTI_TENANT_STRATEGY.md`

**Naming disambiguation:**

| Term | Meaning |
|------|---------|
| **AIMS** | AI Management System — canonical registry + `ai_usage_logs` |
| **AIMS Analytics (Phase 5)** | Unified usage intelligence layer built on AIMS + rollups |
| **Legacy runtime** | `AiUsageRecord` + legacy rollups — dual-write target for retirement |
| **Feature** | Product surface key (e.g. `CHAT`, `FARM_BRIEFING`) |
| **Task type** | Router/orchestrator task enum (e.g. `GENERAL_CHAT`, `VISION_TRIAGE`) |

---

## Executive summary

Phases 1–4 established **registry-authoritative routing** (`AiProvider`, `AiModel`, `AiRoute`, `AiRouterEngine`) and **partial usage capture** (`AiUsageLog`, `AiUsageService`, daily/monthly rollups, Prometheus counters, Super Admin Monitoring Center). Today analytics are **fragmented**: dual canonical tables, incomplete tenant dimensions, rollups without latency/error percentiles, and dashboards scoped only to platform `SUPER_ADMIN` / `ADMIN`.

**Phase 5 Usage Analytics** delivers a **single analytics plane** that answers, for every role:

> Who used AI, through which provider/model/route, at what cost, with what performance, and where failures occurred — by day, month, branch, and user.

This plan defines architecture, schema, aggregation, APIs, dashboards, and export behavior. **Phase 5.0–5.1 core analytics services and summary APIs are implemented** (see Implementation progress below).

---

## Implementation progress

| Sub-phase | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **5.0** | Unified analytics services reading `AiUsageLog` + existing rollups | **Done** | Usage, cost, provider, model, performance summary services |
| **5.1** | Metrics aggregator + daily/monthly reconciliation jobs | **Done** | Idempotent upsert into existing rollup tables |
| **5.2** | Role dashboards (Super / Org / Branch), scope guard | **Pending** | APIs ready; UI + RBAC extension pending |
| **5.3** | Async export jobs, reconciliation cron wiring | **Partial** | Jobs callable; worker/cron registration pending |
| **5.4** | Model + provider daily cubes (new tables) | **Pending** | Uses log aggregation + existing rollups |
| **5.5** | Scheduled reports, partitioning, cold archive | **Pending** | |
| **5.6** | Legacy `AiUsageRecord` retirement | **Pending** | |

### Delivered artifacts (5.0–5.1)

**Module structure**

```
src/modules/ai/analytics/
├── metrics/
│   ├── ai-analytics-summary.types.ts
│   ├── ai-analytics-source.util.ts
│   ├── ai-usage-analytics-summary.service.ts
│   ├── ai-cost-analytics.service.ts
│   ├── ai-provider-analytics.service.ts
│   ├── ai-model-analytics.service.ts
│   ├── ai-performance-analytics.service.ts
│   ├── ai-metrics-aggregator.service.ts
│   └── ai-analytics-metrics.test.ts
└── jobs/
    ├── ai-daily-metrics.job.ts
    └── ai-monthly-metrics.job.ts
```

**Admin API (legacy compat + BFF proxies)**

| Method | Path |
|--------|------|
| GET | `/api/admin/ai-ops/analytics/usage/summary` |
| GET | `/api/admin/ai-ops/analytics/usage/cost-summary` |
| GET | `/api/admin/ai-ops/analytics/usage/provider-summary` |
| GET | `/api/admin/ai-ops/analytics/usage/model-summary` |
| GET | `/api/admin/ai-ops/analytics/usage/performance-summary` |

---

## Original plan (architecture reference)

Phases 1–4 established **registry-authoritative routing** (`AiProvider`, `AiModel`, `AiRoute`, `AiRouterEngine`) and **partial usage capture** (`AiUsageLog`, `AiUsageService`, daily/monthly rollups, Prometheus counters, Super Admin Monitoring Center). Today analytics are **fragmented**: dual canonical tables, incomplete tenant dimensions, rollups without latency/error percentiles, and dashboards scoped only to platform `SUPER_ADMIN` / `ADMIN`.

**Phase 5 Usage Analytics** delivers a **single analytics plane** that answers, for every role:

> Who used AI, through which provider/model/route, at what cost, with what performance, and where failures occurred — by day, month, branch, and user.

The sections below remain the **architecture reference** for remaining sub-phases.

---

## Strategic intent

| Before Phase 5 | After Phase 5 |
|----------------|---------------|
| Dual-write to `AiUsageRecord` + `AiUsageLog` | **`AiUsageLog` is canonical**; legacy table read-only then archived |
| Cost from in-memory rate cache at write time | **Rate version snapshot** on every log row; historical cost recomputable |
| Platform-only daily rollups (`feature × provider × model`) | **Multi-dimensional rollups** — org, branch, user, provider FK, model FK |
| Scoped queries scan raw records | **Pre-aggregated cubes** for org/branch/user with sub-second dashboard loads |
| Super Admin Monitoring Center only | **Three role dashboards** — Super Admin, Organization Admin, Branch Admin |
| CSV export up to 10k rows from mixed sources | **Tiered export** — inline CSV, async job, signed download, audit trail |
| Prometheus metrics disconnected from admin UI | **Operational + business metrics** unified in analytics API and optional Grafana pack |
| Router trace fields partially populated | **Every hop attempt** logged with route, failover, hop index, provider/model FK |

---

## Design principles

| Principle | Phase 5 interpretation |
|-----------|------------------------|
| **Log once, aggregate many** | Append-only `AiUsageLog`; all dashboards read rollups or materialized views |
| **Registry-linked analytics** | Prefer `providerId` / `modelId` FK joins; denormalize keys for export resilience |
| **Immutable economics** | Persist `rateVersion`, `inputCostUsd`, `outputCostUsd` at write time |
| **Tenant-safe by default** | Every query enforces actor scope; cross-tenant leakage is impossible at service layer |
| **Fail open on write, fail closed on read** | Usage logging never blocks LLM calls; unauthorized analytics returns 403 |
| **UTC buckets** | All daily/monthly buckets use UTC midnight / UTC month start (existing convention) |
| **Eventually consistent rollups** | Real-time upsert for hot path; nightly reconciliation job for drift correction |
| **Observable pipeline** | Metrics on ingest lag, rollup freshness, export job status |
| **Retention tiered** | Hot raw logs 90d → warm rollups 24mo → cold archive object storage |

---

## Current state (Phase 4 baseline)

### What exists today

| Area | Artifact | Maturity |
|------|----------|----------|
| **Canonical log (AIMS)** | `AiUsageLog` — FK to provider, model, route, prompt, failover; taskType, tokens, cost, latency | Schema production; partial FK population |
| **Legacy log** | `AiUsageRecord` — org/branch/clinic/doctor dims; no router FKs | Dual-write active |
| **Ingestion** | `AiUsageService.recordAttempt()` → transaction + rollups + `writeAimsUsageLog()` | Implemented |
| **Cost engine** | `AiCostRateService` — DB rates + cache; `AiModelRateHistory` append-only | Partial rateVersion on logs |
| **Platform rollups** | `AiUsageDailyRollup` — date × feature × provider × model | Implemented |
| **User rollups** | `AiUsageUserDailyRollup`, `AiUsageCustomerDailyRollup` | Implemented |
| **Org rollups** | `AiUsageMonthlyRollup` — dimensionType org/branch/clinic/doctor/platform | Monthly only; no daily branch cube |
| **Analytics service** | `AiUsageAnalyticsService` — dashboard, daily/monthly cost, provider/feature compare | Implemented |
| **Report export** | `AiUsageReportService` — JSON + CSV, 10k cap | Implemented |
| **Admin APIs** | `/analytics/usage/{dashboard,daily-cost,monthly-cost,providers,features,trends,report}` | Super Admin only |
| **Prometheus** | `ai_requests_total`, `ai_tokens_total`, `ai_cost_usd_total`, latency histogram | Implemented; not in admin UI |
| **Health snapshots** | `AiProviderHealthSnapshot` | Probes only; not joined to usage analytics |
| **Alerts** | `AiUsageAlert` — spike detection | Basic |
| **Admin UI** | `MonitoringCenterPanel` — overview, trends, provider/feature tabs | Super Admin Control Center |
| **RBAC** | `ai.analytics.view`, `ai.analytics.export` on SUPER_ADMIN / ADMIN | No org/branch admin roles |
| **Router integration** | `recordAttempt()` accepts routeId, providerId, modelId, failoverRuleId | Partially wired from orchestrator |

### Gaps Phase 5 must close

| ID | Gap | Impact |
|----|-----|--------|
| G1 | **Dual canonical tables** — reports prefer logs then fall back to records | Inconsistent totals; duplicate storage |
| G2 | **No daily branch/org rollup** — scoped filters scan raw rows | Slow branch dashboards at scale |
| G3 | **Incomplete tenant dimensions** — org/branch from env config, not request context | Branch analytics unreliable |
| G4 | **Missing registry FKs on many log rows** | Provider/model analytics cannot join health/cost metadata |
| G5 | **No latency percentiles or error taxonomy rollups** | Performance dashboards show averages only |
| G6 | **No model-level analytics cube** with family/category | Model Registry ROI invisible |
| G7 | **No hop-level / failover analytics** | Router Phase 4 observability incomplete |
| G8 | **No org/branch admin RBAC** | Enterprise dashboard requirement unmet |
| G9 | **Export limited to 10k inline** | Finance/compliance cannot pull full month |
| G10 | **Rate version not consistently snapshotted** | Historical cost drift when admin changes rates |
| G11 | **No reconciliation job** | Rollup drift after failed transactions |
| G12 | **Cached/batch token economics not tracked** | Cost optimization blind spot |

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI Request Path (Phase 4 Router)                     │
│  Governance → Budget → AiRouterEngine → Provider Adapter → Response         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ every attempt (success + failure)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AiUsageIngestionService (Phase 5)                         │
│  • Enrich: org/branch/user/providerId/modelId/routeId/rateVersion           │
│  • Compute: inputCostUsd, outputCostUsd, billable flags                     │
│  • Emit: Prometheus + optional OpenTelemetry span attributes                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         ┌──────────────────┐            ┌──────────────────────┐
         │  AiUsageLog       │            │  Hot-path rollup      │
         │  (append-only)    │            │  upsert (sync/async)  │
         └─────────┬─────────┘            └──────────┬───────────┘
                   │                                  │
                   │         ┌──────────────────────────┘
                   │         ▼
                   │  ┌─────────────────────────────────────────┐
                   │  │  Rollup tables (daily + monthly cubes)   │
                   │  └─────────────────┬───────────────────────┘
                   │                    │
                   ▼                    ▼
         ┌─────────────────────────────────────────────────────────┐
         │              AiUsageAnalyticsService                       │
         │  Query router: rollups → MV → raw logs (fallback)        │
         │  Scope enforcement: platform | org | branch               │
         └─────────────────────────┬───────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
   Super Admin Dashboard   Org Admin Dashboard    Branch Admin Dashboard
           │                       │                       │
           └───────────────────────┴───────────────────────┘
                                   │
                                   ▼
                         Export / Report Jobs
```

### Module structure (planned)

```
src/modules/ai/analytics/
├── ingestion/
│   ├── ai-usage-ingestion.service.ts      # unified write path
│   ├── ai-usage-enrichment.service.ts     # tenant + registry FK resolution
│   └── ai-usage-ingestion.types.ts
├── rollups/
│   ├── ai-rollup-writer.service.ts        # hot-path upserts
│   ├── ai-rollup-reconciliation.job.ts    # nightly drift fix
│   └── ai-rollup.dimensions.ts
├── usage/
│   ├── ai-usage-analytics.service.ts      # extend existing
│   ├── ai-usage-performance.service.ts    # latency + error analytics
│   ├── ai-usage-report.service.ts         # extend export
│   └── ai-usage-scope.guard.ts            # tenant RBAC
├── export/
│   ├── ai-usage-export.job.service.ts
│   └── ai-usage-export.storage.ts
└── dashboards/
    ├── super-admin.dashboard.ts
    ├── org-admin.dashboard.ts
    └── branch-admin.dashboard.ts
```

---

## Analytics domains

### 1. AI Usage Tracking

**Purpose:** Count every orchestrator/router attempt with full business context.

| Field group | Required dimensions | Source |
|-------------|---------------------|--------|
| Identity | `requestId`, `correlationId`, `sessionId` | Orchestrator input |
| Actor | `userId`, `customerId` | Auth context |
| Tenant | `scopeKey`, `tenantId`, `organizationId`, `branchId` | Request middleware + `resolveUsageDimensions()` |
| Product | `feature`, `taskType` | Feature map + router |
| Routing | `routeId`, `failoverRuleId`, `hopIndex`, `isFallback`, `fromProviderKey` | Router engine trace |
| Outcome | `success`, `errorCode`, `errorCategory` | Adapter response |

**Write contract:** One row per **adapter invocation attempt** (including retries and failover hops). Final user-facing response may aggregate multiple rows under one `correlationId`.

**Cardinality controls:**

- `metadataJson` for extensibility; never indexed keys inside JSON for dashboard queries
- Error message text never stored in analytics tables (error code + category only)

---

### 2. Token Tracking

**Purpose:** Measure prompt/completion consumption for billing, quotas, and optimization.

| Metric | Definition | Notes |
|--------|------------|-------|
| `inputTokens` | Prompt + system + tool tokens billed by provider | From adapter usage block |
| `outputTokens` | Completion tokens | From adapter usage block |
| `cachedInputTokens` | Provider-reported cache hits | New column; Phase 5 |
| `totalTokens` | input + output (excludes cached from total unless provider bills) | Existing |
| `billableTokens` | Tokens counted against tenant quota | Existing logic in `accountTokens()` |
| `contextUtilizationPct` | inputTokens / model.contextWindow | Computed at query time via model FK |

**Rollup aggregates:** sum tokens, avg tokens/request, p95 tokens/request by dimension.

**Quota integration:** Branch and org dashboards surface `% of monthly token budget` from `AiBudgetService` (read-only join).

---

### 3. Cost Tracking

**Purpose:** USD (and future BDT display) cost attribution with audit-grade economics.

**Cost computation at write time:**

```
inputCostUsd  = inputTokens  × rateSnapshot.inputCostPerToken
outputCostUsd = outputTokens × rateSnapshot.outputCostPerToken
cachedCostUsd = cachedInputTokens × rateSnapshot.cachedInputCostPerToken (if applicable)
costUsd       = inputCostUsd + outputCostUsd + cachedCostUsd
```

**Rate snapshot resolution order:**

1. `AiModelRateHistory` row effective at `createdAt` for `modelId`
2. Current `AiModel` rates if history missing (bootstrap)
3. Legacy `estimateAiCostUsdLegacy()` fallback — flagged `rateSource: 'legacy'` in metadata

**Persist on log row:** `rateVersion`, `inputCostUsd`, `outputCostUsd`, `costUsd`, `currency`, `rateSource`.

**Billable vs platform cost:**

| Type | Meaning |
|------|---------|
| `costUsd` | Platform provider spend |
| `billableCostUsd` | Amount attributed to tenant billing (may differ via markup rules — Phase 5 stores both) |

**Cost analytics views:**

- Daily / monthly spend trend
- Cost per feature, provider, model, user, branch
- Cost per successful request vs failed request (failures cost $0 unless provider bills)
- Fallback premium — extra cost from `isFallback=true` rows vs primary route
- Rate change impact report — compare periods before/after `AiModelRateHistory` effective dates

---

### 4. Provider Analytics

**Purpose:** Compare upstream providers for reliability, cost, and share of traffic.

**Joins:** `AiUsageLog.providerId` → `AiProvider` (displayName, priority, healthScore, costTier).

| KPI | Formula / source |
|-----|------------------|
| Request volume | count by providerKey |
| Success rate | successes / requests |
| Share of cost | provider cost / total cost |
| Share of tokens | provider tokens / total tokens |
| Avg / p50 / p95 latency | from rollup latency histogram fields |
| Fallback rate | fallback requests / total |
| Error breakdown | group by `errorCategory` |
| Health correlation | join `AiProviderHealthSnapshot` rolling 24h |
| Connection test status | `AiProvider.lastConnectionTestOk` badge on dashboard |

**Provider comparison table columns:** provider, requests, successRate, totalTokens, costUsd, avgLatencyMs, p95LatencyMs, fallbackCount, topErrorCode, healthScore.

**Drill-down:** provider → models used → features → daily trend.

---

### 5. Model Analytics

**Purpose:** Registry ROI — which models deliver value at what cost.

**Joins:** `AiUsageLog.modelId` → `AiModel` (modelFamily, modelCategory, modelType, contextWindow).

| KPI | Notes |
|-----|-------|
| Requests by model | Enabled vs disabled model traffic (flag anomalies) |
| Cost efficiency | costUsd / successful request |
| Token efficiency | outputTokens / inputTokens ratio |
| Family breakdown | aggregate by `modelFamily` |
| Category breakdown | `general_chat`, `vision`, `veterinary`, etc. |
| Default model adherence | % requests on `isDefault=true` model vs overrides |
| Deprecation tracking | traffic to models with `deprecatedAt` set |

**Model leaderboard:** top 10 by cost, top 10 by volume, top 10 by error rate.

**Rate history overlay:** chart cost trend when admin changes model rates (from `AiModelRateHistory`).

---

### 6. User Analytics

**Purpose:** Per-user consumption for support, abuse detection, and farmer/doctor insights.

**Sources:** `AiUsageUserDailyRollup` (extend) + `AiUsageLog` drill-down.

| View | Audience | Metrics |
|------|----------|---------|
| Top users (platform) | Super Admin | tokens, cost, requests, last active |
| User detail | Super Admin, Org Admin (scoped) | daily trend, feature mix, provider mix |
| Customer (farmer) rollup | Super Admin | via `AiUsageCustomerDailyRollup` |
| Anomaly flags | Super Admin | spike vs 7d baseline, >p99 latency |

**Privacy:** Org/Branch admins see **pseudonymized labels** (display name + internal id); no prompt content.

**Limits:** User lookup capped at org/branch membership validation before returning data.

---

### 7. Branch Analytics

**Purpose:** Operational spend and performance per branch for franchise / clinic network model.

**Prerequisite:** Reliable `branchId` on every log row from authenticated request context (not env-only).

| KPI | Rollup grain |
|-----|--------------|
| Branch daily cost | `AiUsageBranchDailyRollup` (new) |
| Branch monthly cost | extend `AiUsageMonthlyRollup` or dedicated table |
| Branch vs org share | branch cost / org cost |
| Top branches by spend | Super Admin + Org Admin |
| Branch feature mix | branch × feature |
| Branch error rate | branch × errorCategory |

**Org Admin view:** all branches in org, sortable table + map placeholder (future geography join).

**Branch Admin view:** single branch only — cannot query sibling branches.

---

### 8. Daily Usage Metrics

**Platform daily cube** — extend `AiUsageDailyRollup`:

| Dimension | Current | Phase 5 |
|-----------|---------|---------|
| Keys | date, feature, provider, model | + optional `providerId`, `modelId` |
| Measures | requests, tokens, cost, latency sum | + p50/p95 latency, error counts by category, fallback count, cached tokens |

**Additional daily cubes:**

| Table | Grain | Primary use |
|-------|-------|-------------|
| `AiUsageBranchDailyRollup` | date × branchId × feature × provider × model | Branch Admin dashboard |
| `AiUsageOrgDailyRollup` | date × organizationId × feature × provider × model | Org Admin dashboard |
| `AiUsageProviderDailyRollup` | date × providerId | Provider SLA dashboard |
| `AiUsageModelDailyRollup` | date × modelId | Model Registry analytics |
| `AiUsageErrorDailyRollup` | date × errorCategory × provider | Error ops dashboard |

**Freshness SLA:** rollups ≤ 5 minutes behind raw log for hot path; reconciliation within 24h.

---

### 9. Monthly Usage Metrics

**Extend `AiUsageMonthlyRollup`:**

| Enhancement | Detail |
|-------------|--------|
| Add `feature` to grain | Monthly feature spend per org/branch |
| Add `successRate`, `p95LatencyMs` | Performance monthly review |
| Add `billableCostUsd`, `billableTokens` | Finance reconciliation |
| Separate `AiUsagePlatformMonthlyRollup` | Platform-wide without dimensionType polymorphism |

**Monthly report pack (auto-generated):**

- Executive summary PDF/data — total spend, MoM delta, top 5 drivers
- Per-org invoice support CSV
- Provider invoice reconciliation (compare platform totals vs provider billing exports — manual upload Phase 5.2)

---

### 10. AI Performance Metrics

**Purpose:** SLO tracking for AI product quality.

| Metric | Target (default) | Source |
|--------|------------------|--------|
| Availability | 99.5% success (excl. user errors) | success rate rollups |
| Latency p95 | < 8s chat, < 15s vision | latency histogram |
| Time to first token (TTFT) | < 2s streaming | new `ttftMs` column when streaming |
| Fallback rate | < 5% | isFallback rollups |
| Timeout rate | < 1% | errorCode=timeout |
| Cache hit rate | maximize | cachedInputTokens / inputTokens |

**SLO dashboard widget:** traffic-light against configurable thresholds in `AiSettings`.

**Session-level performance:** group by `sessionId` — turns per session, avg latency per turn.

---

### 11. Latency Metrics

**Storage strategy:** Store `latencyMs` on every log row; aggregate into rollup **sketch fields**:

| Rollup column | Purpose |
|---------------|---------|
| `latencyMsSum` | mean computation (existing) |
| `latencyMsMin` | best case |
| `latencyMsMax` | worst case |
| `latencyMsP50` | median (TDigest or fixed buckets) |
| `latencyMsP95` | tail latency |
| `latencyMsP99` | outlier tracking |
| `latencySampleCount` | weight for mean |

**Histogram buckets (Prometheus-aligned):** 100ms, 250ms, 500ms, 1s, 2s, 5s, 10s, 30s+.

**Breakdowns:** latency by provider, model, feature, branch, hour-of-day.

**Router attribution:** latency per `hopIndex` — detect slow failover hops.

---

### 12. Error Metrics

**Error taxonomy** — normalize adapter/orchestrator codes into categories:

| Category | Example codes |
|----------|---------------|
| `RATE_LIMIT` | 429, rate_limit_exceeded |
| `TIMEOUT` | timeout, deadline_exceeded |
| `AUTH` | invalid_api_key, 401, 403 |
| `CONTEXT` | context_length_exceeded |
| `PROVIDER` | 5xx, upstream_error |
| `GOVERNANCE` | kill_switch, budget_exceeded, consent_required |
| `VALIDATION` | bad_request, invalid_image |
| `UNKNOWN` | unmapped |

**Rollups:** `AiUsageErrorDailyRollup` — date × errorCategory × provider × feature × branchId (nullable).

**Dashboard panels:**

- Error rate trend (overall + by category)
- Top error codes (last 24h / 7d)
- Failover trigger correlation — errors that caused route failover
- Provider error heatmap (provider × category)

**Alerting hooks:** integrate with existing `AiUsageAlert` — error rate > threshold, auth errors spike (key rotation signal).

---

## Role-based dashboards

### Capability matrix (planned extension)

| Capability | SUPER_ADMIN | ORG_ADMIN | BRANCH_ADMIN | ADMIN (legacy) |
|------------|-------------|-----------|--------------|----------------|
| `ai.analytics.view` | ✓ platform | ✓ own org | ✓ own branch | ✓ platform |
| `ai.analytics.export` | ✓ all | ✓ own org | ✓ own branch | ✓ platform |
| `ai.analytics.providers` | ✓ | ✓ read-only | ✗ | ✓ |
| `ai.analytics.models` | ✓ | ✓ read-only | ✗ | ✓ |
| `ai.analytics.users` | ✓ all | ✓ org users | ✓ branch users | ✓ all |
| `ai.analytics.routing` | ✓ | ✗ | ✗ | ✓ |
| `ai.analytics.reconcile` | ✓ | ✗ | ✗ | ✗ |

**Scope enforcement:** `AiUsageScopeGuard` validates `organizationId` / `branchId` filters against actor membership before any query executes.

---

### Super Admin dashboard

**Route:** `/admin/ai-ops/analytics` (extend existing Monitoring Center)

| Section | Widgets |
|---------|---------|
| **Executive KPIs** | requests, tokens, cost (USD), success rate, p95 latency, fallback rate, MoM delta |
| **Spend** | daily + monthly cost charts, budget burn vs platform cap |
| **Providers** | comparison table, health overlay, connection status |
| **Models** | family pie, top models by cost, deprecated model warnings |
| **Features** | feature cost table, taskType breakdown |
| **Tenants** | org + branch leaderboard, drill-down |
| **Users** | top users/customers, lookup |
| **Performance** | latency histogram, SLO status |
| **Errors** | category trend, top codes, failover correlation |
| **Routing** | route usage, failover frequency (requires Phase 4 trace completeness) |
| **Exports** | report builder, async job status |

**Unique Super Admin actions:** global date range, cross-org comparison, reconciliation status, retention admin.

---

### Organization Admin dashboard

**Route:** `/admin/org/ai-analytics` (new — or scoped tab when org context present)

| Section | Widgets |
|---------|---------|
| **Org KPIs** | org-scoped requests, tokens, cost, success rate, avg latency |
| **Spend** | org daily/monthly trend, budget vs actual |
| **Branches** | branch comparison table, top branches by cost |
| **Features** | which product features drive org spend |
| **Users** | top users within org, user lookup (org-scoped) |
| **Performance** | org latency trend, error rate |
| **Exports** | org-filtered CSV/monthly invoice pack |

**Hidden from Org Admin:** platform provider secrets, global routing rules, other orgs, model rate editing.

---

### Branch Admin dashboard

**Route:** `/admin/branch/ai-analytics` (new)

| Section | Widgets |
|---------|---------|
| **Branch KPIs** | branch requests, tokens, cost, success rate |
| **Spend** | branch daily trend (30d), monthly summary |
| **Features** | feature usage mix for branch |
| **Users** | branch staff / farmer usage (scoped) |
| **Performance** | branch latency, error count |
| **Exports** | branch CSV (max 90d default) |

**Hidden from Branch Admin:** provider-level comparison, model registry, other branches, routing configuration.

---

## Database schema changes

### A. Extend `AiUsageLog` (canonical fact table)

```prisma
// Additions to existing AiUsageLog — migration only, no replacement
model AiUsageLog {
  // ... existing fields ...

  clinicId          String?   @db.VarChar(64)
  doctorId          String?   @db.VarChar(64)

  hopIndex          Int       @default(0)
  attemptIndex      Int       @default(0)

  cachedInputTokens Int       @default(0)
  inputCostUsd      Decimal?  @db.Decimal(10, 6)
  outputCostUsd     Decimal?  @db.Decimal(10, 6)
  billableCostUsd   Decimal?  @db.Decimal(10, 6)
  currency          String    @default("USD") @db.VarChar(8)
  rateSource        String?   @db.VarChar(16)  // registry | history | legacy

  ttftMs            Int?
  errorCategory     String?   @db.VarChar(32)

  // indexes
  @@index([branchId, createdAt])
  @@index([organizationId, branchId, createdAt])
  @@index([modelId, createdAt])
  @@index([errorCategory, createdAt])
  @@index([bucketDate])  // generated or denormalized UTC date column for partition prep
}
```

**Partitioning (Phase 5.3):** range partition on `createdAt` monthly — prepare column + migration strategy document; physical partitions optional until >10M rows/month.

---

### B. New rollup tables

```prisma
model AiUsageBranchDailyRollup {
  id               String   @id @default(cuid())
  bucketDate       DateTime @db.Date
  branchId         String   @db.VarChar(64)
  organizationId   String?  @db.VarChar(64)
  feature          String
  providerId       String?
  providerKey      String   @db.VarChar(32)
  modelId          String?
  modelKey         String   @db.VarChar(128)
  requestCount     Int      @default(0)
  successCount     Int      @default(0)
  failureCount     Int      @default(0)
  inputTokens      Int      @default(0)
  outputTokens     Int      @default(0)
  cachedInputTokens Int     @default(0)
  totalTokens      Int      @default(0)
  billableTokens   Int      @default(0)
  costUsd          Decimal  @default(0) @db.Decimal(12, 6)
  billableCostUsd  Decimal  @default(0) @db.Decimal(12, 6)
  latencyMsSum     Int      @default(0)
  latencyMsP50     Int      @default(0)
  latencyMsP95     Int      @default(0)
  fallbackCount    Int      @default(0)
  timeoutCount     Int      @default(0)
  errorCountByCategoryJson Json @default("{}")
  updatedAt        DateTime @updatedAt

  @@unique([bucketDate, branchId, feature, providerKey, modelKey])
  @@index([branchId, bucketDate])
  @@index([organizationId, bucketDate])
  @@map("ai_usage_branch_daily_rollups")
}

model AiUsageOrgDailyRollup {
  id               String   @id @default(cuid())
  bucketDate       DateTime @db.Date
  organizationId   String   @db.VarChar(64)
  feature          String
  providerKey      String   @db.VarChar(32)
  modelKey         String   @db.VarChar(128)
  requestCount     Int      @default(0)
  successCount     Int      @default(0)
  failureCount     Int      @default(0)
  totalTokens      Int      @default(0)
  costUsd          Decimal  @default(0) @db.Decimal(12, 6)
  billableCostUsd  Decimal  @default(0) @db.Decimal(12, 6)
  latencyMsSum     Int      @default(0)
  latencyMsP95     Int      @default(0)
  fallbackCount    Int      @default(0)
  updatedAt        DateTime @updatedAt

  @@unique([bucketDate, organizationId, feature, providerKey, modelKey])
  @@index([organizationId, bucketDate])
  @@map("ai_usage_org_daily_rollups")
}

model AiUsageProviderDailyRollup {
  id            String   @id @default(cuid())
  bucketDate    DateTime @db.Date
  providerId    String
  providerKey   String   @db.VarChar(32)
  requestCount  Int      @default(0)
  successCount  Int      @default(0)
  failureCount  Int      @default(0)
  totalTokens   Int      @default(0)
  costUsd       Decimal  @default(0) @db.Decimal(12, 6)
  latencyMsSum  Int      @default(0)
  latencyMsP95  Int      @default(0)
  fallbackCount Int      @default(0)
  errorJson     Json     @default("{}")
  updatedAt     DateTime @updatedAt

  @@unique([bucketDate, providerId])
  @@index([providerKey, bucketDate])
  @@map("ai_usage_provider_daily_rollups")
}

model AiUsageModelDailyRollup {
  id            String   @id @default(cuid())
  bucketDate    DateTime @db.Date
  modelId       String
  modelKey      String   @db.VarChar(128)
  modelFamily   String?  @db.VarChar(32)
  providerId    String
  requestCount  Int      @default(0)
  successCount  Int      @default(0)
  totalTokens   Int      @default(0)
  costUsd       Decimal  @default(0) @db.Decimal(12, 6)
  latencyMsP95  Int      @default(0)
  updatedAt     DateTime @updatedAt

  @@unique([bucketDate, modelId])
  @@index([modelFamily, bucketDate])
  @@map("ai_usage_model_daily_rollups")
}

model AiUsageErrorDailyRollup {
  id             String   @id @default(cuid())
  bucketDate     DateTime @db.Date
  errorCategory  String   @db.VarChar(32)
  errorCode      String?  @db.VarChar(64)
  providerKey    String?  @db.VarChar(32)
  feature        String?
  branchId       String?  @db.VarChar(64)
  organizationId String?  @db.VarChar(64)
  occurrenceCount Int     @default(0)
  updatedAt      DateTime @updatedAt

  @@index([bucketDate, errorCategory])
  @@index([branchId, bucketDate])
  @@map("ai_usage_error_daily_rollups")
}
```

---

### C. Extend existing rollups

**`AiUsageDailyRollup`** — add: `providerId`, `modelId`, `cachedInputTokens`, `fallbackCount`, `timeoutCount`, `latencyMsP50`, `latencyMsP95`, `errorCountByCategoryJson`.

**`AiUsageMonthlyRollup`** — add: `feature`, `billableCostUsd`, `billableTokens`, `fallbackCount`, `latencyMsP95`.

**`AiUsageUserDailyRollup`** — add: `successCount`, `failureCount`, `latencyMsSum`, `organizationId`, `branchId` (denormalized for scoped queries).

---

### D. Export job table

```prisma
model AiUsageExportJob {
  id              String   @id @default(cuid())
  requestedByUserId String
  scopeType       String   @db.VarChar(16)  // platform | organization | branch
  scopeId         String?  @db.VarChar(64)
  filtersJson     Json
  format          String   @db.VarChar(8)   // csv | json | xlsx
  status          String   @default("pending") @db.VarChar(16)
  rowCount        Int?
  fileStorageKey  String?
  fileSizeBytes   Int?
  errorMessage    String?  @db.Text
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  @@index([requestedByUserId, createdAt])
  @@index([status, createdAt])
  @@map("ai_usage_export_jobs")
}
```

---

### E. Legacy retirement plan

| Phase | Action |
|-------|--------|
| 5.0 | Stop dual-write to `AiUsageRecord`; read-only legacy |
| 5.1 | Backfill `AiUsageLog` gaps from records (one-time migration) |
| 5.2 | Archive `AiUsageRecord` to cold storage; drop table in Phase 6 |

---

## Aggregation strategy

### Hot path (synchronous with ingest)

On each `recordAttempt`:

1. Insert `AiUsageLog` (single transaction leader)
2. Upsert platform `AiUsageDailyRollup`
3. Upsert scoped rollups based on present dimensions:
   - user → `AiUsageUserDailyRollup`
   - customer → `AiUsageCustomerDailyRollup`
   - branch → `AiUsageBranchDailyRollup`
   - organization → `AiUsageOrgDailyRollup`
   - providerId → `AiUsageProviderDailyRollup`
   - modelId → `AiUsageModelDailyRollup`
   - error → `AiUsageErrorDailyRollup`
4. Upsert `AiUsageMonthlyRollup` for each applicable dimension
5. Increment Prometheus counters (existing)

**Failure handling:** if rollup upsert fails, log error and enqueue **rollup repair event** (Redis stream or DB queue) — never fail LLM response.

### Warm path (async worker — every 5 min)

- Consume repair events
- Re-aggregate affected buckets from raw logs
- Update `latencyMsP50/P95` using t-digest merge from sample rows

### Cold path (nightly cron — 02:00 UTC)

| Job | Action |
|-----|--------|
| `reconcile-platform-daily` | Compare sum(logs) vs rollups for yesterday; fix drift |
| `reconcile-branch-org` | Validate branch totals ⊆ org totals |
| `compact-monthly` | Roll daily → monthly for completed month (idempotent) |
| `purge-export-jobs` | Delete expired export files |
| `archive-raw-logs` | Move logs older than retention to object storage (optional 5.3) |

### Query routing logic

```
function queryAnalytics(filters, actorScope):
  if filters.granularity <= 1 day AND no high-cardinality drill-down:
    source = daily rollup table matching actorScope
  else if filters.granularity <= 31 days AND scoped:
    source = org/branch daily rollups
  else if monthly:
    source = AiUsageMonthlyRollup
  else if requires hop-level OR error message OR >90d raw:
    source = AiUsageLog (with strict limit + index)
  apply scope guard BEFORE query
```

**Performance targets:**

| Query | Target p95 |
|-------|------------|
| Dashboard KPIs (30d) | < 300ms |
| Provider comparison | < 500ms |
| User drill-down | < 800ms |
| Raw log search | < 2s ( capped at 1000 rows ) |
| Async export (1M rows) | < 10 min background |

---

## Reporting APIs

All routes under `/api/admin/ai-ops/analytics/usage/` with BFF proxies in `pranidoctor-web`. Existing routes **extended**, not replaced.

### Existing routes (enhance)

| Method | Path | Enhancement |
|--------|------|-------------|
| GET | `/dashboard` | Add latency percentiles, error summary, scope-aware defaults |
| GET | `/daily-cost` | Branch/org series when scoped |
| GET | `/monthly-cost` | Feature dimension; billable columns |
| GET | `/providers` | Join registry metadata; health badge |
| GET | `/features` | TaskType sub-breakdown |
| GET | `/trends` | Granularity param: hour/day/week |
| GET | `/report` | Async mode via `?async=true` |

### New routes (Phase 5)

| Method | Path | Purpose | Capability |
|--------|------|---------|------------|
| GET | `/models` | Model analytics leaderboard | `ai.analytics.view` |
| GET | `/models/[modelId]` | Model detail time series | `ai.analytics.view` |
| GET | `/branches` | Branch comparison (org-scoped) | `ai.analytics.view` |
| GET | `/branches/[branchId]` | Branch detail dashboard | `ai.analytics.view` |
| GET | `/organizations/[orgId]` | Org detail (Super Admin) | `ai.analytics.view` |
| GET | `/users/top` | Top users with scope filter | `ai.analytics.view` |
| GET | `/performance` | SLO + latency histogram | `ai.analytics.view` |
| GET | `/errors` | Error category breakdown | `ai.analytics.view` |
| GET | `/errors/codes` | Top error codes | `ai.analytics.view` |
| GET | `/routing` | Route + failover stats | `ai.analytics.routing` |
| POST | `/exports` | Create async export job | `ai.analytics.export` |
| GET | `/exports/[jobId]` | Poll job status / download URL | `ai.analytics.export` |
| GET | `/exports` | List recent exports for actor | `ai.analytics.export` |
| GET | `/reconciliation/status` | Last nightly job result | `ai.analytics.reconcile` |
| POST | `/reconciliation/run` | Manual reconcile (Super Admin) | `ai.analytics.reconcile` |

### Request / response conventions

**Common query params:**

| Param | Type | Description |
|-------|------|-------------|
| `from`, `to` | ISO date | Explicit range |
| `sinceDays` | int | Shorthand (default 30, max 365) |
| `organizationId` | string | Filter — validated against actor |
| `branchId` | string | Filter — validated against actor |
| `provider`, `model`, `feature`, `taskType` | string | Dimension filters |
| `granularity` | enum | hour, day, week, month |
| `timezone` | string | Display only; buckets remain UTC |

**Dashboard response envelope:**

```typescript
interface AnalyticsDashboardResponse {
  range: { from: string; to: string };
  scope: { type: 'platform' | 'organization' | 'branch'; id?: string };
  freshness: { lastRollupAt: string; lagSeconds: number };
  kpis: UsageKpiBlock;
  series: { daily: DailyPoint[]; monthly: MonthlyPoint[] };
  breakdowns: {
    providers: ProviderRow[];
    models: ModelRow[];
    features: FeatureRow[];
    branches?: BranchRow[];
    errors: ErrorRow[];
  };
  performance: LatencyBlock;
}
```

### Org / Branch scoped API paths (alternative layout)

For clearer RBAC separation, mirror routes under:

- `/api/admin/org/[orgId]/ai-analytics/*`
- `/api/admin/branch/[branchId]/ai-analytics/*`

Both layouts resolve to the same service with mandatory scope injection from URL path + actor validation.

---

## Export strategy

### Tier 1 — Inline export (existing, enhanced)

| Attribute | Value |
|-----------|-------|
| Formats | CSV, JSON |
| Max rows | 10,000 |
| Max range | 90 days |
| Auth | `ai.analytics.export` |
| Scope | Enforced filters |
| Audit | `AiPlatformAuditService.log('analytics.export.inline')` |

**CSV columns (standard pack):**

`timestamp, requestId, correlationId, organizationId, branchId, userId, customerId, feature, taskType, provider, model, providerId, modelId, routeId, hopIndex, inputTokens, outputTokens, cachedInputTokens, totalTokens, costUsd, billableCostUsd, latencyMs, ttftMs, success, errorCode, errorCategory, isFallback, fromProviderKey, rateVersion`

### Tier 2 — Async export job

| Attribute | Value |
|-----------|-------|
| Formats | CSV, JSON, XLSX (optional 5.2) |
| Max rows | 1,000,000 |
| Max range | 365 days |
| Delivery | Signed URL, expires 72h |
| Storage | S3/MinIO `ai-exports/{jobId}.csv` |
| Notification | Admin email when complete (optional) |
| Concurrency | 2 jobs per user, 10 platform-wide |

**Job lifecycle:** `pending → processing → completed | failed | expired`

### Tier 3 — Scheduled reports (Phase 5.3)

| Report | Schedule | Audience |
|--------|----------|----------|
| Platform daily digest | 06:00 UTC | Super Admin email |
| Org monthly invoice CSV | 1st of month | Org Admin |
| Provider SLA weekly | Monday | Super Admin |

Stored as `AiUsageExportJob` with `recurrenceJson` — implementation deferred to 5.3.

### Export security

- PII minimization: no prompt/content columns in any export
- Signed URLs single-use optional for sensitive org exports
- All exports logged with actor, filters, row count
- Branch Admin exports exclude provider-level pricing metadata (cost only)

---

## Integration with existing platform components

### AI Router (Phase 4)

Router engine **must** pass to ingestion on every hop:

- `routeId`, `hopIndex`, `attemptIndex`
- `providerId`, `modelId` (resolved registry IDs)
- `failoverRuleId` when failover action fires
- `fromProviderKey` on fallback hops

Without complete router trace, **Routing analytics** and **failover premium cost** reports remain incomplete (G7).

### AI Provider Management (Phase 2)

Provider analytics join:

- `AiProvider.healthScore`, `lastConnectionTestOk`, `enabled`
- Provider disable events correlated with error spikes

### AI Model Registry (Phase 3)

Model analytics join:

- `AiModel.modelFamily`, `modelCategory`, `contextWindow`
- `AiModelRateHistory` for cost trend overlays and `rateVersion` snapshot

### AI Usage Logs (Phase 1)

`AiUsageLog` becomes **sole write target**. `writeAimsUsageLog()` absorbed into `AiUsageIngestionService`.

---

## Sub-phases & delivery roadmap

| Sub-phase | Scope | Priority |
|-----------|-------|----------|
| **5.0** | Unified ingestion, rate snapshot, stop dual-write, extend `AiUsageLog` | P0 |
| **5.1** | Branch/org daily rollups, scope guard, enhanced dashboard APIs | P0 |
| **5.2** | Role dashboards (Super / Org / Branch), latency + error rollups | P0 |
| **5.3** | Async export jobs, reconciliation cron, backfill migration | P1 |
| **5.4** | Model + provider daily cubes, routing analytics | P1 |
| **5.5** | Scheduled reports, partitioning, cold archive | P2 |
| **5.6** | Legacy `AiUsageRecord` retirement | P2 |

### Implementation progress (detailed roadmap)

| Sub-phase | Status |
|-----------|--------|
| 5.0 – Unified ingestion + summary services | **Done** |
| 5.1 – Aggregator + daily/monthly jobs | **Done** |
| 5.2 – Role dashboards | **Pending** |
| 5.3 – Async export + cron | **Partial** |
| 5.4 – Provider/model daily cubes | **Pending** |
| 5.5 – Scheduled reports + archive | **Pending** |
| 5.6 – Legacy retirement | **Pending** |

---

## Verification & acceptance criteria

| ID | Criterion |
|----|-----------|
| V1 | 100% of orchestrator attempts produce exactly one `AiUsageLog` row per hop |
| V2 | Dashboard KPI totals match sum of raw logs ±0.01 USD for yesterday after reconciliation |
| V3 | Branch Admin querying another branchId receives 403 |
| V4 | Org Admin sees all branches in org; no cross-org data |
| V5 | Provider comparison loads < 500ms p95 for 30d platform range |
| V6 | CSV export respects scope; audit log entry created |
| V7 | Async export completes 100k rows within 5 min in staging |
| V8 | Rate change on model does not alter historical cost for prior log rows |
| V9 | Error category taxonomy covers ≥95% of production error codes |
| V10 | Legacy `AiUsageRecord` receives zero writes for 7 consecutive days before cutover |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Rollup write amplification on hot path | Async rollup queue for branch/org cubes; sync only platform daily |
| Incomplete branchId in request context | Middleware requirement before Phase 5.1; fallback to `unknown` bucket |
| Query cost on raw log scans | Strict query router; mandatory date bounds; rollup-first |
| Export PII exposure | Column allowlist per role; no prompt fields |
| Historical backfill cost | Batched backfill job; off-peak execution |
| Dual-table confusion during migration | Feature flag `AI_USAGE_CANONICAL=aims`; monitoring on record write attempts |

---

## Out of scope (Phase 6+)

- Cross-tenant analytics warehouse / BI tool (Metabase, BigQuery)
- Real-time streaming dashboard (WebSocket sub-second)
- Farmer-facing usage meter in mobile app
- Automated provider invoice ingestion and variance reconciliation
- BDT currency conversion for display (USD remains canonical)
- ML-based cost anomaly detection

---

## Summary

Phase 5 transforms Prani Doctor's AI platform from **operational logging with partial rollups** into an **enterprise analytics plane** built on `AiUsageLog`, multi-dimensional daily/monthly cubes, registry-linked provider/model intelligence, and role-scoped dashboards for Super Admin, Organization Admin, and Branch Admin — with tiered export, reconciliation, and a clear path to retire legacy `AiUsageRecord`.

**Canonical data flow:** Router → Ingestion → `AiUsageLog` → Rollups → Scoped Analytics APIs → Dashboards / Exports.

**Phase 5.0–5.1 implemented:** summary services, metrics aggregator, reconciliation jobs, and five summary API endpoints — all reading canonical `AiUsageLog` and existing rollup tables without duplicate storage.
