# Dashboard Guide — Prani Doctor Monitoring

**Version:** 1.0 · 2026-05-30

---

## Prerequisites

1. Prometheus scraping `GET /metrics` with `METRICS_TOKEN`
2. Grafana 10+ (self-hosted on VPS recommended)
3. Import JSON from [dashboards/](./dashboards/)

---

## Import procedure

1. Grafana → **Dashboards** → **New** → **Import**
2. Upload JSON or paste contents from `docs/monitoring/dashboards/<name>.json`
3. Select Prometheus data source (default: `Prometheus`)
4. Save — set folder `Prani Doctor`

---

## Dashboard index

| File | Purpose | Key panels |
|------|---------|------------|
| [api-overview.json](./dashboards/api-overview.json) | HTTP RED metrics | Request rate, 5xx %, p95 latency, status codes |
| [database.json](./dashboards/database.json) | PostgreSQL app metrics | DB up, probe latency, query rate, slow queries |
| [queue.json](./dashboards/queue.json) | BullMQ health | Queue up, waiting/active/failed, job outcomes |
| [security.json](./dashboards/security.json) | Auth & security | Auth failures by surface, security events |
| [ai-ops.json](./dashboards/ai-ops.json) | AI ecosystem | Request rate, failures, fallbacks, cost, latency |
| [business-kpi.json](./dashboards/business-kpi.json) | Operational escalation | OPS gauges, pending backlog links |

---

## Recommended layout

```
Grafana
└── Prani Doctor/
    ├── 01 — API Overview      (on-call home)
    ├── 02 — Database
    ├── 03 — Queue
    ├── 04 — Security
    ├── 05 — AI Ops
    └── 06 — Business KPI
```

---

## Panel → metric mapping

### API Overview

| Panel | PromQL |
|-------|--------|
| Request rate | `sum(rate(pranidoctor_http_requests_total[5m]))` |
| 5xx rate | `sum(rate(pranidoctor_http_requests_total{status_class="5xx"}[5m])) / sum(rate(pranidoctor_http_requests_total[5m]))` |
| p95 latency | `histogram_quantile(0.95, sum(rate(pranidoctor_http_request_duration_seconds_bucket[5m])) by (le))` |
| Top routes | `topk(10, sum by (route) (rate(pranidoctor_http_requests_total[5m])))` |

### Database

| Panel | PromQL |
|-------|--------|
| DB up | `pranidoctor_db_up` |
| Probe latency | `pranidoctor_db_probe_latency_ms` |
| Slow queries | `rate(pranidoctor_db_slow_queries_total[5m])` |

### Queue

| Panel | PromQL |
|-------|--------|
| Queue up | `pranidoctor_queue_up` |
| Waiting jobs | `sum(pranidoctor_queue_waiting_jobs)` |
| Failed jobs | `rate(pranidoctor_queue_jobs_total{outcome="failed"}[15m])` |

### Security

| Panel | PromQL |
|-------|--------|
| Auth failures | `sum by (surface) (rate(pranidoctor_auth_failures_total[5m]))` |
| Security events | `sum by (event) (rate(pranidoctor_security_events_total[5m]))` |

### AI Ops

| Panel | PromQL |
|-------|--------|
| AI requests | `sum by (status) (rate(ai_requests_total[5m]))` |
| Fallback rate | `sum(rate(ai_requests_total{provider="rules-based"}[5m])) / sum(rate(ai_requests_total[5m]))` |
| Token cost | `rate(ai_cost_usd_total[1h])` |

### Business KPI

Uses `escalation_*` gauges from operational monitoring. Pair with admin `/admin` for business context.

---

## Admin UI dashboards (no Grafana required)

| Route | Purpose |
|-------|---------|
| `/admin` | Executive KPIs |
| `/admin/ai-ops` | AI sessions, governance |
| `/admin/launch-ops` | Manual health probe UI |
| `/admin/analytics/system` | Queue/session visibility |

---

## Mobile crash dashboards

- **Firebase Crashlytics** — crash-free sessions, top issues
- **Sentry mobile project** — if `SENTRY_DSN` configured
- Webhook ingest from `CRASH_REPORTING_WEBHOOK_URL`

See [flutter-crash-reporting-plan.md](../../pranidoctor_user/docs/production/mobile/flutter-crash-reporting-plan.md).

---

## Maintenance

- Update dashboard JSON when new metric names ship
- Review panel thresholds after baseline week (see production-monitoring-plan §10)
- Link Grafana home to runbook: `docs/monitoring/runbook.md`
