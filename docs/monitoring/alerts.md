# Alert Catalog — Prani Doctor

**Version:** 1.0 · 2026-05-30  
**Source of truth (Prometheus):** [deploy/monitoring/prometheus-alerts.yml](../../deploy/monitoring/prometheus-alerts.yml)  
**In-app webhooks:** [alerting-plan.md](../../pranidoctor_user/docs/production/monitoring/alerting-plan.md)

---

## Priority tiers

| Tier | Response | Channel |
|------|----------|---------|
| **P0** | Immediate (<15 min ack) | PagerDuty / Slack @channel |
| **P1** | <1 hour ack | Slack `#pranidoctor-alerts` |
| **P2** | Business hours | Slack digest / dashboard |

---

## P0 — Critical

| Alert | PromQL / trigger | Alert ID | Runbook |
|-------|------------------|----------|---------|
| **ApiDown** | `up{job="pranidoctor-api"} == 0` | ALT-DOWN-06 | [runbook § Service unavailable](./runbook.md#service-unavailable) |
| **ApiReadinessFailed** | `pranidoctor_ready == 0` | ALT-DOWN-02 | Same |
| **DatabaseDown** | `pranidoctor_db_up == 0` | ALT-DB-01 | [runbook § Database](./runbook.md#database-unavailable) |
| **RedisUnavailable** | `pranidoctor_redis_up == 0` | ALT-SEC-02 | [runbook § Cache](./runbook.md#cache-unavailable) |
| **QueueSubsystemDown** | `pranidoctor_queue_up == 0` | ALT-ERR-09 | [runbook § Queue](./runbook.md#queue-failures) |
| **AuthFailureSpike** | `rate(pranidoctor_auth_failures_total[5m]) > 1.5` | ALT-SEC-01 | [runbook § Auth](./runbook.md#auth-failure-spike) |
| **AiFailureSpike** | AI failure rate >5% for 10m | ALT-AI-01 | [runbook § AI](./runbook.md#ai-failures) |

### In-app P0 webhooks (shipped)

| Alert ID | Trigger |
|----------|---------|
| ALT-DOWN-02 | `/ready` returns 503 |
| ALT-DB-01 | `/health/db` unhealthy |
| ALT-SEC-02 | `/health/redis` unhealthy (production) |
| ALT-ERR-02 | uncaughtException / unhandledRejection |

Configure: `MONITORING_ALERT_WEBHOOK_URL`

---

## P1 — Warning

| Alert | Condition | Alert ID |
|-------|-----------|----------|
| **High5xxRate** | 5xx >1% for 5m | ALT-ERR-01 |
| **HighApiLatencyP95** | HTTP p95 >2s for 10m | ALT-SLOW-05 |
| **SlowDbQueries** | slow query rate >0.5/s | ALT-DB-03 |
| **QueueJobFailures** | failed job rate >0.1/s | ALT-ERR-08 |
| **StorageUnavailable** | `pranidoctor_storage_up == 0` | ALT-DOWN-03 |
| **AiFallbackSpike** | rules-based >30% for 15m | ALT-AI-02 |

### In-app P1 webhooks

| Alert ID | Trigger |
|----------|---------|
| ALT-ERR-01 | API 5xx in error handler |
| ALT-ERR-04 | Admin BFF proxy 5xx |
| ALT-ERR-09 | `/health/queue` unhealthy |

---

## P2 — Informational

| Alert | Condition | Alert ID |
|-------|-----------|----------|
| **HighHeapUsage** | heap >512MB for 15m | ALT-RES-01 |
| **HighEventLoopLag** | lag >100ms for 10m | ALT-RES-02 |
| **QueueBacklogHigh** | waiting jobs >100 for 30m | ALT-QUE-01 |

---

## External monitors (ops-owned, not in repo)

Configure before public launch:

- UptimeRobot/Better Stack on `GET /ready` (API)
- BFF `GET /api/admin/health/ready`
- SSL certificate expiry (<7d = P0)
- Backup cron exit code + file age (>26h = P1)

---

## Alert fatigue controls

- Dedup window: 15 min (`ALERT_DEDUP_WINDOW_MS`)
- Storm caps: `ALERT_MAX_CRITICAL_PER_MIN=10`
- Sentry owns stack traces; webhooks own probe/state alerts
- Exclude expected 401/404/422 from paging (auth spike uses dedicated metric)
