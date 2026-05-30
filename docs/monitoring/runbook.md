# Monitoring Runbook — Prani Doctor

**Version:** 1.0 · 2026-05-30  
**On-call:** Document primary/backup in team wiki (not in git)

---

## Service unavailable

**Alerts:** `ApiDown`, `ApiReadinessFailed`, `ALT-DOWN-02`, external uptime on `/ready`

### Triage (first 5 minutes)

1. Confirm scope: `curl -s -o /dev/null -w "%{http_code}" https://<api-host>/ready`
2. Check recent deploys (GitHub Actions, container tag)
3. Inspect API logs: `docker logs pranidoctor-api --tail 200`
4. Check dependencies: `GET /health/dependencies?lite=1`

### Common causes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `/ready` 503, DB unhealthy | PostgreSQL down | Restart postgres; check disk |
| `/ready` 503, Redis unhealthy | Redis down | Restart redis; rate limits fail closed |
| Process not listening | Crash loop | Check `ALT-ERR-02` uncaught errors; rollback image |
| 502 from nginx | Upstream timeout | Check API memory/event loop lag |

### Rollback

See [ROLLBACK_PLAN.md](../../pranidoctor_user/docs/launch/ROLLBACK_PLAN.md) — redeploy previous API/web image tag. DB migrations are forward-only.

---

## Database unavailable

**Alerts:** `DatabaseDown`, `ALT-DB-01`, `/health/db` unhealthy

1. `GET /health/db` — note latency and message
2. Check postgres container: `docker ps`, `pg_isready`
3. Review slow query metrics: `pranidoctor_db_slow_queries_total`
4. If corruption suspected: stop writes → restore from backup ([backup-recovery.md](../../pranidoctor_user/docs/backup-recovery.md))

---

## Cache unavailable

**Alerts:** `RedisUnavailable`, `ALT-SEC-02`, `/health/cache` or `/health/redis` unhealthy

1. Redis down causes **503 on rate-limited paths** in production
2. Restart redis container; verify AOF persistence
3. After recovery, confirm `/ready` returns 200

---

## Queue failures

**Alerts:** `QueueSubsystemDown`, `QueueJobFailures`, `ALT-ERR-08/09`

1. `GET /health/queue` — initialized queues, waiting/failed counts
2. Check worker process if separate from API
3. Inspect logs for `event=queue.job` with `phase=failed`
4. Permanent failures appear in Sentry with `source=background_job`
5. Retry: restart worker; re-enqueue failed jobs via admin if applicable

---

## Auth failure spike

**Alerts:** `AuthFailureSpike`, `ALT-SEC-01`

1. Check `pranidoctor_auth_failures_total` by `surface` label
2. Search logs: `event=security` or auth audit failures
3. If single IP: block at nginx/WAF
4. If widespread: check JWT secret rotation, Redis session store, OTP provider
5. Token reuse: follow [incident-response-guide.md](../../pranidoctor_user/docs/incident-response-guide.md) auth compromise section

---

## AI failures

**Alerts:** `AiFailureSpike`, `AiFallbackSpike`, `ALT-AI-01/02`

1. Admin panel: `/admin/ai-ops/governance` — kill switch state
2. Metrics: `ai_requests_total{status="failure"}`, `ai_fallbacks_total`
3. Provider outage: enable kill switch (rules-based fallback)
4. Review `/admin/ai-ops/risk` for escalation spike

---

## Elevated errors

**Alerts:** `High5xxRate`, `ALT-ERR-01`

1. Grafana API dashboard — error rate by route
2. Sentry — new issues in production release
3. Correlate with deploy time; consider rollback if post-release

---

## High latency

**Alerts:** `HighApiLatencyP95`, `ALT-SLOW-05`

1. Check `pranidoctor_http_request_duration_seconds` p95
2. DB probe latency: `pranidoctor_db_probe_latency_ms`
3. Slow queries: `pranidoctor_db_slow_queries_total`
4. Admin proxy slowness: web logs `event=admin.proxy` with high `durationMs`

---

## Slow queries

**Alerts:** `SlowDbQueries`

1. Threshold: `DB_SLOW_QUERY_MS` (default 200ms)
2. Metrics by model/operation: `pranidoctor_db_query_duration_seconds`
3. Scale connection pool or optimize hot queries
4. Phase 2: enable `pg_stat_statements` via postgres_exporter

---

## Storage issues

**Alerts:** `StorageUnavailable`, `/health/storage` unhealthy

1. MinIO/S3 reachability from API container
2. Upload failures in API logs
3. Non-required in dev; required when `MEDIA_STORAGE=s3` in prod

---

## Resource warnings

**Alerts:** `HighHeapUsage`, `HighEventLoopLag` (P2)

1. Metrics: `pranidoctor_heap_used_bytes`, `pranidoctor_event_loop_lag_ms`
2. Restart API if sustained; investigate memory leak if recurring
3. P2 — address in business hours unless paired with 5xx

---

## Workflow trace lookup

Structured logs use `event=workflow.trace` with `workflow` and `step` fields:

| Workflow | Steps |
|----------|-------|
| `appointment` | `service_request_created` |
| `doctor_consultation` | `doctor_accepted` |
| `livestock` | `feed_consumption_recorded` |
| `ai` | `orchestrator_start`, `orchestrator_complete` |
| `authentication` | `otp_verify_success` |

Correlate with `requestId` / `traceId` across API and web logs.

---

## Emergency silence

1. `MONITORING_ENABLED=false` on API/web — stops webhook alerts
2. Mute external uptime monitors during planned maintenance
3. Disable Alertmanager routes or increase `for:` duration temporarily

No API contract or schema change required.
