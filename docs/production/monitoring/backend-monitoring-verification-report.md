# Backend Monitoring — Verification Report

**Date:** 2026-05-30  
**Scope:** `pranidoctor-backend` Phase 1 observability (metrics, logs, health, Sentry, alerts)  
**Method:** Static code review, unit-test execution, Prometheus rule alignment audit  
**Reference:** [backend-monitoring-plan.md](./backend-monitoring-plan.md), [sentry-verification-report.md](./sentry-verification-report.md)

**Code changes required for this verification:** None.

---

## Executive verdict — monitoring readiness

| Dimension | Result | Confidence | Production-ready? |
|-----------|--------|------------|-------------------|
| Metrics collection (HTTP/DB/resources) | **PASS** | High | Yes — with ops scrape config |
| Metrics collection (queues) | **PARTIAL** | Medium | Infrastructure only — no workers registered |
| Log quality | **PASS** | High | Yes |
| Slow query visibility | **PARTIAL** | High | Metrics yes; SQL text omitted in prod logs |
| Database monitoring | **PARTIAL** | High | App-level yes; no Postgres exporter |
| Error tracking | **PASS** | Medium | Code yes; live Sentry not smoke-tested |
| Resource monitoring | **PARTIAL** | High | Memory + event loop yes; no CPU |
| Alert rule alignment | **PASS** | High | Rules match exported metric names |
| Dashboards / log shipping | **NOT DEPLOYED** | N/A | Ops follow-up |

**Overall readiness:** **Conditionally ready for production monitoring** — application instrumentation is in place and tested, but **ops must deploy Prometheus scrape targets, probe schedules, and log aggregation** before alerts and dashboards are actionable.

### Readiness scorecard

| Layer | Score | Notes |
|-------|-------|-------|
| Application instrumentation | **9/10** | Phase 1 complete; queue depth + worker scrape missing |
| Operational deployment | **4/10** | Prometheus/Grafana/Loki not in repo |
| Alerting (in-app webhooks) | **8/10** | Health routes fire deduplicated alerts |
| Alerting (Prometheus rules) | **7/10** | Aligned; some edge-case expr gaps |
| Documentation | **9/10** | Plan + env vars documented |

---

## 1. Validation — metrics collection

### 1.1 HTTP (latency, volume, errors)

| Check | Status | Evidence |
|-------|--------|----------|
| Request counter by method/route/status | ✅ | `http.metrics.ts` → `pranidoctor_http_requests_total` |
| Latency histogram | ✅ | `pranidoctor_http_request_duration_seconds` |
| Route cardinality control | ✅ | `normalizeRoutePath()` collapses UUIDs/numeric IDs |
| Probe exclusion | ✅ | `isProbePath()` skips `/health/*`, `/metrics`, `/live`, `/ready` |
| Middleware wired | ✅ | `app.ts` — `createHttpMetricsMiddleware()` before pino-http |
| Toggle | ✅ | `HTTP_METRICS_ENABLED`, `METRICS_ENABLED` |
| Exported on scrape | ✅ | `metrics.routes.ts` → `renderAllPrometheusLines()` |

**Unit tests:** 26/26 passed (`monitoring.metrics.test.ts`, `ai-usage*.test.ts`).

### 1.2 Database query metrics

| Check | Status | Evidence |
|-------|--------|----------|
| Query count + duration histogram | ✅ | `db.metrics.ts` |
| Slow query counter | ✅ | `pranidoctor_db_slow_queries_total` |
| Prisma hook | ✅ | `prisma.ts` `$on('query')` when `DB_QUERY_METRICS_ENABLED` |
| Connectivity gauge | ✅ | `recordDatabaseProbe()` on `SELECT 1` |
| Probe latency gauge | ✅ | `pranidoctor_db_probe_latency_ms` |

### 1.3 Queue metrics

| Check | Status | Evidence |
|-------|--------|----------|
| Job completed/failed counters | ✅ | `queue.service.ts` → `recordQueueJob()` |
| Job duration histogram | ✅ | `pranidoctor_queue_job_duration_seconds` |
| Workers running in repo | ⚠️ | `createWorker()` **not called** anywhere; worker process has no processors |
| Worker `/metrics` endpoint | ❌ | `worker.ts` has no HTTP server — queue metrics not scrapeable from worker-only process |

### 1.4 Dependency gauges

| Check | Status | Evidence |
|-------|--------|----------|
| `pranidoctor_db_up` | ✅ | Updated on `checkDatabaseConnection()` |
| `pranidoctor_redis_up` | ✅ | Updated on Redis health probe |
| `pranidoctor_ready` | ✅ | Updated on `/ready` via `getReadinessStatus()` |
| Freshness on scrape | ⚠️ | Gauges reflect **last probe**, not live check at scrape time |
| Redis disabled | ⚠️ | `REDIS_ENABLED=false` path skips `recordRedisProbe()` — gauge may be absent/stale |

### 1.5 Resource metrics

| Check | Status | Evidence |
|-------|--------|----------|
| RSS / heap used / heap total | ✅ | `resource.metrics.ts` refreshed on scrape |
| Event loop lag | ✅ | 1s background sampler → `pranidoctor_event_loop_lag_ms` |
| CPU utilization | ❌ | Not exported (use node_exporter) |
| Legacy heap alias preserved | ✅ | `pranidoctor_heap_used_bytes` still on `/metrics` |

### 1.6 Metrics endpoint security

| Check | Status | Evidence |
|-------|--------|----------|
| Production auth required | ✅ | `METRICS_TOKEN` or 401 in production |
| Non-prod open when token unset | ✅ | Documented behavior |
| `/metrics/json` backward compatible | ✅ | Shape unchanged (Phase 1 series not mirrored in JSON) |

---

## 2. Validation — log quality

| Check | Status | Evidence |
|-------|--------|----------|
| Structured JSON (prod) | ✅ | Pino + `LOG_FORMAT=json` |
| Base fields | ✅ | `service`, `version`, `env`, ISO timestamp |
| Request correlation | ✅ | ALS mixin: `requestId`, `traceId`, `spanId`, `userId` |
| HTTP structured fields | ✅ | `event=http.request`, `route`, `statusClass`, `requestId` |
| Status-driven log level | ✅ | 5xx→error, 4xx→warn |
| Secret redaction | ✅ | passwords, tokens, OTP, authorization, cookie paths |
| Probe noise reduction | ✅ | Access logs skip probe paths (expanded vs. pre-Phase 1) |
| Error path logging | ✅ | `error.handler.ts` logs code, path, elapsed; 5xx → capture + alert |

**Sample log shape (HTTP success):**

```json
{
  "level": "info",
  "event": "http.request",
  "route": "/api/mobile/feeds",
  "statusClass": "2xx",
  "requestId": "...",
  "req": { "method": "GET", "url": "/api/mobile/feeds", "path": "/api/mobile/feeds" },
  "res": { "statusCode": 200 },
  "responseTime": 42
}
```

**Gap:** No centralized log shipping config in repo (Promtail/Loki/CloudWatch left to ops).

---

## 3. Validation — slow query visibility

| Signal | Status | Detail |
|--------|--------|--------|
| Prometheus counter | ✅ | `pranidoctor_db_slow_queries_total{model,operation}` |
| Structured slow-query log | ✅ | `event=db.query.slow`, `durationMs`, `thresholdMs`, `model`, `operation` |
| Configurable threshold | ✅ | `DB_SLOW_QUERY_MS` (default 200) |
| SQL text in prod logs | ❌ Intentionally omitted | Security-safe; use staging or PG logs for query text |
| SQL text when metrics disabled + dev | ✅ | Truncated 200 chars in dev-only branch |
| Label accuracy | ⚠️ | Best-effort SQL parse (`prisma-query-labels.ts`); complex joins may label `raw` |
| Alert rule | ✅ | `SlowDbQueries` in `prometheus-alerts.yml` |

**Unit test:** SQL label parsing verified for standard `SELECT ... FROM "User"`.

**Not tested:** End-to-end slow query log emission under load (requires running DB).

---

## 4. Validation — database monitoring

| Layer | Status | Evidence |
|-------|--------|----------|
| Synthetic probe | ✅ | `checkDatabaseConnection()` → `SELECT 1` |
| Health JSON latency | ✅ | `/health/db`, `/ready`, `/health` aggregate |
| Prometheus up/latency | ✅ | `pranidoctor_db_up`, `pranidoctor_db_probe_latency_ms` |
| Query performance metrics | ✅ | In-process histogram per model/operation |
| In-app alert on DB down | ✅ | `/health/db` unhealthy → `ALT-DB-01` webhook |
| Prisma ORM errors | ✅ | `$on('error')` + `mapPrismaError` → HTTP |
| Connection pool metrics | ❌ | pg Pool waiting/idle count not exported |
| Postgres server metrics | ❌ | No `postgres_exporter` / `pg_stat_statements` in repo |

---

## 5. Validation — error tracking

| Path | Status | Evidence |
|------|--------|----------|
| API 5xx → Pino + Sentry + webhook alert | ✅ | `error.handler.ts` |
| Unhandled errors → capture | ✅ | Same handler path |
| 4xx not sent to Sentry | ✅ | Client errors log at warn only |
| Process fatal (API) | ✅ | `server.ts` uncaught/unhandled → Sentry |
| Process fatal (worker) | ✅ | `worker.ts` same pattern |
| Queue permanent failure | ✅ | `queue.service.ts` → Sentry tags |
| Dual-path rollback | ✅ | Blank DSN / `SENTRY_ENABLED=false` |
| Production alert webhooks | ✅ | `alert-service.ts`, dedup + rate limits |
| Live Sentry ingest | ⚠️ Not verified | See [sentry-verification-report.md](./sentry-verification-report.md) |

Error tracking is **orthogonal to Prometheus** but completes the observability stack for incident response.

---

## 6. Validation — resource monitoring

| Metric | Status | Source |
|--------|--------|--------|
| Heap used (legacy + new) | ✅ | `/metrics` top-level + `pranidoctor_process_heap_used_bytes` |
| RSS | ✅ | `pranidoctor_process_rss_bytes` |
| Event loop lag | ✅ | Background sampler |
| Health memory check | ✅ | `/health` — heap % degraded/unhealthy thresholds |
| Health event loop check | ✅ | `/health` — lag >50ms degraded, >100ms unhealthy |
| CPU | ❌ | Only in `/health/system` (non-production) |
| Prometheus alerts for memory/lag | ❌ | No rules in `prometheus-alerts.yml` |

---

## 7. Gaps report

### P0 — blocks reliable production alerting

| ID | Gap | Impact | Mitigation |
|----|-----|--------|------------|
| G-P0-01 | **Prometheus not deployed** in repo/CI | Alert rules unused | Deploy scrape config targeting API `/metrics` with `METRICS_TOKEN` |
| G-P0-02 | **Dependency gauges stale** until probes run | `pranidoctor_ready`, `pranidoctor_db_up` may be missing or old | Schedule blackbox probes: `/ready` every 30s, `/health/db` every 60s |
| G-P0-03 | **No log aggregation** wired | Cannot query HTTP/DB logs at scale | Ship JSON logs to Loki/CloudWatch |

### P1 — reduces observability quality

| ID | Gap | Impact | Mitigation |
|----|-----|--------|------------|
| G-P1-01 | **Queue workers not registered** | `pranidoctor_queue_jobs_*` never increments | Register processors; scrape API process or add worker metrics port |
| G-P1-02 | **Worker process not scrapeable** | Queue/DB metrics in worker memory invisible to Prometheus | Expose minimal `/metrics` on worker or run workers in API process |
| G-P1-03 | **`/metrics/json` lacks Phase 1 fields** | Debug tooling sees only legacy snapshot | Add optional extended JSON (backward compatible) |
| G-P1-04 | **`High5xxRate` divide-by-zero** when no traffic | False-positive or NaN alert | Add `sum(rate(...)) > 0` guard in PromQL |
| G-P1-05 | **In-memory metrics per replica** | Counters not global across pods | Prometheus `sum()` aggregation; document multi-instance scrape |
| G-P1-06 | **Redis disabled omits gauge update** | `pranidoctor_redis_up` ambiguous | Set gauge to `1` with label or document N/A for disabled Redis |
| G-P1-07 | **No integration test for `/metrics`** | Auth/format regressions possible | Add supertest scrape test |

### P2 — Phase 2 enhancements

| ID | Gap | Impact |
|----|-----|--------|
| G-P2-01 | No CPU / node_exporter | Cannot alert on CPU saturation |
| G-P2-02 | No pg pool / waiting client metrics | Slow leaks under load hard to detect |
| G-P2-03 | No queue depth gauges (waiting/active) | Backlog invisible until jobs fail |
| G-P2-04 | No Grafana dashboards | Operators rely on raw PromQL |
| G-P2-05 | Slow-query logs omit SQL in prod | DBA debugging needs PG-side tooling |
| G-P2-06 | Empty metric series export TYPE only | Some dashboards show empty panels until first sample |

---

## 8. Recommendations

### Immediate (before go-live)

1. **Deploy Prometheus scrape** for `pranidoctor-api` job:
   - Target: `https://<api-host>/metrics`
   - Header: `Authorization: Bearer $METRICS_TOKEN`
   - Interval: 15–30s

2. **Configure blackbox probes** (or Prometheus `probe`/`blackbox_exporter`):
   - `GET /live` — liveness
   - `GET /ready` — refreshes `pranidoctor_ready` + dependency gauges
   - `GET /health/db` — DB latency SLO

3. **Set production env vars:**
   ```env
   LOG_FORMAT=json
   METRICS_ENABLED=true
   METRICS_TOKEN=<secret>
   DB_SLOW_QUERY_MS=200
   MONITORING_ENABLED=true
   MONITORING_ALERT_WEBHOOK_URL=<slack-or-pagerduty>
   SENTRY_DSN=<staging-first-then-prod>
   APP_VERSION=<semver>
   ```

4. **Fix PromQL guard** for `High5xxRate`:
   ```promql
   sum(rate(pranidoctor_http_requests_total{status_class="5xx"}[5m]))
   /
   sum(rate(pranidoctor_http_requests_total[5m])) > 0.01
   and sum(rate(pranidoctor_http_requests_total[5m])) > 0
   ```

5. **Run staging smoke tests** (manual):
   - Hit API routes → verify `pranidoctor_http_requests_total` increments
   - Trigger 500 → verify 5xx counter + Sentry + webhook alert
   - Call `/ready` → verify `pranidoctor_ready 1`
   - Induce slow query (>200ms) → verify `db.query.slow` log + slow counter

### Short-term (Phase 1.5)

6. **Register BullMQ workers** and decide metrics scrape target (API vs dedicated worker port).

7. **Add `/metrics` integration test** — auth, content-type, required metric names present after synthetic recordings.

8. **Extend `/metrics/json`** with optional `monitoring` block (HTTP/DB/dependency snapshot) without removing existing keys.

9. **Add Prometheus alerts** for:
   - `pranidoctor_event_loop_lag_ms > 100` (10m)
   - `pranidoctor_process_heap_used_bytes / pranidoctor_process_heap_total_bytes > 0.9`

10. **Import Grafana dashboard** — RED panels from `backend-monitoring-plan.md` §7.

### Medium-term (Phase 2)

11. Deploy **node_exporter** + **postgres_exporter** on DB host.

12. Enable **`pg_stat_statements`** for query-plan-level slow query analysis.

13. Export **pg pool stats** (idle, waiting, total) from `poolInstance` in `prisma.ts`.

14. Add **queue depth gauges** (`waiting`, `active`, `delayed`) on metrics scrape.

15. Wire **log shipping** (Promtail → Loki) with saved queries for `event="http.request"` and `event="db.query.slow"`.

---

## 9. Verification evidence

| Artifact | Result |
|----------|--------|
| `monitoring.metrics.test.ts` | ✅ 6 tests passed |
| `ai-usage-monitoring.verify.test.ts` | ✅ passed |
| `ai-usage.unit.test.ts` | ✅ passed |
| `prometheus-alerts.yml` metric names | ✅ aligned with Phase 1 exporters |
| Live `/metrics` scrape | ⚠️ Not run (no running server in CI) |
| Live slow-query log | ⚠️ Not run |

---

## 10. Sign-off checklist

Use this before marking monitoring **production-operational**:

- [ ] Prometheus scraping `/metrics` with token auth
- [ ] Blackbox `/ready` probe ≥ every 60s
- [ ] `MONITORING_ALERT_WEBHOOK_URL` tested with synthetic 503
- [ ] Sentry DSN smoke test on staging (see sentry verification §11)
- [ ] JSON logs visible in aggregation backend
- [ ] Grafana dashboard imported OR runbook documents PromQL queries
- [ ] On-call runbook links this report + [backend-monitoring-plan.md](./backend-monitoring-plan.md)

---

## 11. Related documents

| Document | Purpose |
|----------|---------|
| [backend-monitoring-plan.md](./backend-monitoring-plan.md) | Architecture, metric catalog, rollout phases |
| [sentry-verification-report.md](./sentry-verification-report.md) | Error tracking audit |
| [deploy/monitoring/prometheus-alerts.yml](../../../deploy/monitoring/prometheus-alerts.yml) | Alert rules |

---

**Report status:** Complete — static verification PASS with documented operational gaps.
