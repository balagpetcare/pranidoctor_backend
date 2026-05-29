# Health Check — Readiness Report

**Date:** 2026-05-30  
**Scope:** `pranidoctor-backend` Phase 1 production health probes  
**Method:** Static code review, unit-test execution, alert-path audit, endpoint contract verification  
**Reference:** [health-check-plan.md](./health-check-plan.md), [backend-monitoring-plan.md](./backend-monitoring-plan.md)

**Code changes required for this verification:** None.

---

## Executive verdict — health check readiness

| Dimension | Result | Confidence | Production-ready? |
|-----------|--------|------------|-------------------|
| Liveness accuracy | **PASS** (by design) | High | Yes — with documented limits |
| Readiness accuracy | **PASS** | High | Yes |
| Dependency validation | **PASS** | High | Yes |
| Failure detection (HTTP status codes) | **PASS** | High | Yes |
| Failure detection (alerting) | **PARTIAL** | Medium | Yes — with gaps on storage/queue |
| Live runtime smoke | **NOT RUN** | N/A | Ops follow-up required |
| Unit test coverage | **PARTIAL** | Medium | AI + lite utils covered; readiness matrix untested |

**Overall readiness:** **Conditionally ready for production health probing** — liveness, readiness, granular dependency routes, and metrics side-effects are correctly implemented and aligned with the health plan. **Ops must configure external synthetics on `/ready` and `/live`**, and **staging should run dependency-failure drills** before go-live.

### Readiness scorecard

| Layer | Score | Notes |
|-------|-------|-------|
| Liveness (`/live`) | **8/10** | Correct for K8s pattern; does not detect event-loop stall |
| Readiness (`/ready`) | **9/10** | DB + Redis + conditional storage; queue/AI excluded by design |
| Aggregate (`/health`) | **8/10** | Full picture; memory/queue can 503 while `/ready` passes |
| Granular probes | **9/10** | db, redis, storage, ai + lite mode |
| Dependencies API | **8/10** | Always 200 — diagnostic only, not a traffic gate |
| Alert wiring | **7/10** | ready/db/redis covered; storage failure silent |
| Tests | **6/10** | 10 unit tests; no mocked readiness integration suite |
| Documentation | **9/10** | Plan updated for Phase 1 |

---

## 1. Validation — liveness accuracy

**Endpoint:** `GET /live`  
**Implementation:** `getLivenessStatus()` in `health.service.ts`

| Check | Status | Evidence |
|-------|--------|----------|
| Returns HTTP 200 when process responds | ✅ | Route always `res.status(200)` |
| Body includes `alive: true` | ✅ | Hard-coded in service |
| Body includes `service: "api"` | ✅ | Additive Phase 1 field |
| Body includes ISO `timestamp` | ✅ | `new Date().toISOString()` |
| Does not probe DB/Redis/storage/AI | ✅ | No I/O in liveness handler |
| Rate-limit exempt | ✅ | `probe-exempt.ts` — `/live` in `PROBE_PATHS` |
| Lite mode supported | ✅ | `?lite=1` → `{ alive, service, timestamp }` |

### Liveness limitations (expected)

| Limitation | Impact | Recommendation |
|------------|--------|----------------|
| Never returns `alive: false` | Hung event loop may still answer `/live` until timeout | Pair with **readiness** + external timeout on probes |
| No memory / CPU signal | OOM-kill may be only signal | Use container memory limits + `/health` aggregate for ops dashboards |
| No worker process probe | Background worker has no HTTP | Phase 2 queue consumer heartbeat |

**Verdict:** **PASS** — liveness correctly answers “is the Node process responding?” and intentionally avoids dependency I/O, matching Kubernetes liveness best practice.

---

## 2. Validation — readiness accuracy

**Endpoint:** `GET /ready`  
**Implementation:** `getReadinessStatus()` in `health.service.ts`

### Pass/fail logic (verified against code)

```text
ready === true
⟺ database.status === 'healthy'
⟺ (redis.status === 'healthy' OR redis excluded when REDIS_ENABLED=false)
⟺ (storage.status === 'healthy' OR storage not in check set when !isStorageRequired)
```

| Scenario | Expected | Code behavior | Status |
|----------|----------|---------------|--------|
| DB `SELECT 1` succeeds | `ready: true`, HTTP 200 | `checkDatabase()` → `healthy` | ✅ |
| DB unreachable | `ready: false`, HTTP 503 | `unhealthy` blocks ready | ✅ |
| Redis enabled + `PONG` | Included, must be healthy | In `requiredChecks` | ✅ |
| Redis disabled (`REDIS_ENABLED=false`) | Excluded from required | Filtered in `requiredChecks` | ✅ |
| Redis enabled but not initialized | `ready: false` | Status `degraded` (not healthy) | ✅ |
| Redis ping failure | `ready: false` | Status `unhealthy` | ✅ |
| Storage required + healthy | Must pass | `isStorageRequired` adds check | ✅ |
| Storage required + degraded/unhealthy | `ready: false` | `.every(healthy)` fails | ✅ |
| Storage optional + degraded | `ready: true` | Storage not in readiness set | ✅ |
| AI kill switch / no API keys | `ready: true` | AI not in readiness set | ✅ |
| Queue failure | `ready: true` | Queue not in readiness set | ✅ (by design) |
| Memory >90% heap | `ready: true` | Memory not in readiness set | ⚠️ by design |

### HTTP and side effects

| Check | Status | Evidence |
|-------|--------|----------|
| HTTP 503 when `ready: false` | ✅ | `health.routes.ts` |
| HTTP 200 when `ready: true` | ✅ | Same |
| Fires `ALT-DOWN-02` on failure | ✅ | `alertReadinessFailure()` |
| Updates `pranidoctor_ready` gauge | ✅ | `recordReadiness(ready)` |
| Lite mode preserves `ready` + compact checks | ✅ | `health-response.util.test.ts` |
| Docker Compose probe uses `/ready` | ✅ | `docker-compose.yml` |

**Verdict:** **PASS** — readiness gates traffic on hard dependencies only. Operators should **not** expect `/ready` to reflect queue, AI, or memory pressure.

---

## 3. Validation — dependency validation

**Endpoints:** `GET /health/dependencies`, granular `/health/{db,redis,storage,ai}`, aggregate `GET /health`

### Dependency matrix (verified)

| Dependency | Granular route | In aggregate | In `/ready` | In dependencies API | `required` flag |
|------------|----------------|--------------|-------------|----------------------|-----------------|
| PostgreSQL | `/health/db` | ✅ | ✅ | ✅ `database` | `true` |
| Redis | `/health/redis` | ✅ | ✅ (if enabled) | ✅ `cache` | `isRedisEnabled` |
| BullMQ | — (via `queues` check) | ✅ | ❌ | ✅ `queue` | `false` |
| Object storage | `/health/storage` | ✅ | ✅ (if required) | ✅ `external` | `isStorageRequired` |
| AI services | `/health/ai` | ✅ | ❌ | ✅ `ai` | `false` |

### Probe mechanics

| Dependency | Probe method | Latency recorded | Status semantics |
|------------|--------------|------------------|----------------|
| PostgreSQL | Prisma `SELECT 1` | ✅ ms | healthy / unhealthy |
| Redis | `PING` → `PONG` | ✅ ms | healthy / degraded (disabled) / unhealthy |
| BullMQ | `notification` queue `getWaitingCount()` | ✅ ms | healthy / degraded (no queue) / unhealthy |
| Storage | `storage.checkHealth()` + runtime degrade flags | ✅ ms | healthy / degraded / unhealthy (if required) |
| AI | Kill switch + env key config only | ✅ ms | healthy / degraded only (never unhealthy) |

### Aggregate status rollup

| Rule | Verified |
|------|----------|
| Any check `unhealthy` → aggregate `unhealthy`, HTTP **503** | ✅ |
| Any check `degraded` (no unhealthy) → aggregate `degraded`, HTTP **200** | ✅ |
| All healthy → HTTP **200** | ✅ |
| AI `degraded` does not produce HTTP 503 on `/health/ai` | ✅ (`statusCodeFor` only 503 on unhealthy) |

### Dependencies API behavior

| Check | Status | Note |
|-------|--------|------|
| Always HTTP 200 | ✅ | Diagnostic dashboard endpoint |
| Returns `{ success: true, data: [...] }` | ✅ | Stable contract |
| Lite mode strips latency/messages | ✅ | Tested in `health-response.util.test.ts` |
| Suitable for load-balancer gate | ❌ | Use `/ready` instead |

**Verdict:** **PASS** — all six dependency categories from the health plan are represented; probe depth matches documented Phase 1 scope (config-only AI, single-queue BullMQ sample).

---

## 4. Validation — failure detection

### 4.1 HTTP failure signaling

| Failure | Detection endpoint | HTTP | Verified |
|---------|-------------------|------|----------|
| Database down | `/ready`, `/health/db`, `/health` | 503 | ✅ |
| Redis down (enabled) | `/ready`, `/health/redis`, `/health` | 503 | ✅ |
| Storage down (required) | `/ready`, `/health/storage`, `/health` | 503 | ✅ |
| Storage down (optional) | `/health`, `/health/storage` | 200 degraded | ✅ |
| Queue unreachable | `/health` only | 503 unhealthy | ✅ |
| AI kill switch | `/health/ai`, `/health` | 200 degraded | ✅ |
| Process up, deps down | `/live` | **200** | ✅ (intentional) |

### 4.2 Alert firing

| Event | Alert ID | Trigger location | Verified |
|-------|----------|------------------|----------|
| `/ready` fails | ALT-DOWN-02 | `health.routes.ts` | ✅ |
| `/health/db` unhealthy | ALT-DB-01 | `alertDependencyUnhealthy('database')` | ✅ |
| `/health/redis` unhealthy | ALT-SEC-02 | `alertRedisUnavailable()` — **production only** | ✅ |
| Other dependency unhealthy via granular | ALT-DOWN-03 | Only via `alertDependencyUnhealthy` for db | ⚠️ |
| `/health/storage` unhealthy | — | **No alert hook** | ❌ gap |
| Queue unhealthy | — | No granular route | ❌ gap |
| AI degraded | — | By design (soft dep) | ✅ |
| Alert deduplication | — | `AlertDeduplicator` 60s window | ✅ |

### 4.3 Metrics failure signaling

| Metric | Updated when | Verified |
|--------|--------------|----------|
| `pranidoctor_db_up` | DB probe (`checkDatabaseConnection`) | ✅ |
| `pranidoctor_db_probe_latency_ms` | DB probe | ✅ |
| `pranidoctor_redis_up` | Redis health check | ✅ |
| `pranidoctor_redis_probe_latency_ms` | Redis health check | ✅ |
| `pranidoctor_ready` | `/ready` handler | ✅ |
| Storage / AI / queue gauges | — | ❌ not exported |

**Verdict:** **PARTIAL PASS** — critical path failures (DB, Redis, readiness) are detected via HTTP 503 and webhook alerts. Storage and queue failures require aggregate `/health` monitoring or Phase 2 alert hooks.

---

## 5. Unit test results

**Command:** `npx vitest run src/api/health/`  
**Result:** **10/10 passed** (3 files)

| File | Tests | Coverage |
|------|-------|----------|
| `ai-health.service.test.ts` | 4 | Kill switch, no keys, preferred provider, healthy path |
| `health-response.util.test.ts` | 5 | Lite query, compact health/readiness/dependencies |
| `mobile-health.service.test.ts` | 1 | Mobile profile module contract |

### Test gaps

| Gap | Risk | Recommendation |
|-----|------|----------------|
| No `health.service.test.ts` for readiness matrix | Medium | Add mocked DB/Redis/storage tests |
| No HTTP route integration tests | Low | Supertest smoke for status codes |
| No live dependency failure drill | Medium | Staging: stop postgres/redis/minio |
| No alert webhook smoke | Low | Staging with `MONITORING_ALERT_WEBHOOK_URL` |

---

## 6. Live smoke status

| Test | Result | Notes |
|------|--------|-------|
| `GET http://localhost:3000/live` | **SKIPPED** | No API server listening during verification |
| Staging `/ready` synthetic | **NOT RUN** | Ops pre-go-live task |
| Docker Compose healthcheck | **NOT RUN** | Config verified statically (`wget /ready`) |

---

## 7. Known gaps and risks

| ID | Gap | Severity | Mitigation |
|----|-----|----------|------------|
| HC-V-01 | Liveness cannot detect event-loop hang | Low | Readiness timeout + container restart policy |
| HC-V-02 | `/ready` ignores memory/queue pressure | Medium | Monitor aggregate `/health` separately |
| HC-V-03 | No alert on storage granular failure | Medium | Watch `/health` 503 or add `ALT-DOWN-03` for storage |
| HC-V-04 | Only `notification` queue probed | Medium | Redis health indirectly covers BullMQ broker |
| HC-V-05 | AI probe is config-only | Low | Use `ai_requests_total` + admin AI ops for runtime |
| HC-V-06 | `/health/dependencies` always 200 | Low | Document — not for LB |
| HC-V-07 | Metrics gauges stale until probe hit | Low | Blackbox scrape `/ready` per replica |
| HC-V-08 | Worker process has no HTTP health | Medium | Phase 2 consumer heartbeat |

---

## 8. Pre-production checklist

- [ ] External monitor on `GET /ready` every 30–60s (alert on non-200)
- [ ] External monitor on `GET /live` every 60s (alert on timeout)
- [ ] Staging drill: stop PostgreSQL → confirm `/ready` 503, `/live` 200, `ALT-DOWN-02`
- [ ] Staging drill: stop Redis → confirm `/ready` 503, rate-limit fail-closed behavior
- [ ] Staging drill: stop MinIO (when storage required) → confirm `/ready` 503
- [ ] Confirm `MONITORING_ALERT_WEBHOOK_URL` receives deduplicated alerts
- [ ] Post-deploy: `curl /ready`, `curl /health/ai`, `curl '/health?lite=1'`
- [ ] Per-replica probe so `pranidoctor_ready` reflects each instance

---

## 9. Recommendations (priority order)

1. **Run staging failure drills** (§8) — highest value before production.
2. **Add `health.service.test.ts`** with mocked dependencies for readiness truth-table coverage.
3. **Wire storage unhealthy → `alertDependencyUnhealthy('storage')`** on `/health/storage` (optional Phase 1.1).
4. **Monitor aggregate `/health` status** in Grafana/Uptime for queue/memory 503s that `/ready` misses.
5. **Phase 2:** optional cached LLM provider ping behind `AI_HEALTH_PROBE_ENABLED=true`.

---

## 10. Sign-off summary

| Question | Answer |
|----------|--------|
| Can production use `/live` for liveness? | **Yes** |
| Can production use `/ready` for traffic gates? | **Yes** |
| Are dependency checks accurate for Phase 1 scope? | **Yes** |
| Will hard dependency failures be detected? | **Yes** (HTTP + alerts for DB/Redis/readiness) |
| Is live runtime verification complete? | **No** — requires staging smoke |
| Is automated test coverage sufficient alone? | **No** — add readiness matrix tests + staging drills |

---

**Report status:** Complete — health checks are **conditionally production-ready** pending ops synthetics and staging failure drills.

**Next document:** Update [health-check-plan.md](./health-check-plan.md) §11.5 checklist as ops completes §8 items.
