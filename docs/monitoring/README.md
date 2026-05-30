# Prani Doctor — Monitoring Documentation

**Location:** `pranidoctor-backend/docs/monitoring/`  
**Related:** [production-monitoring-plan.md](../../pranidoctor_user/docs/launch/production-monitoring-plan.md)

| Document | Purpose |
|----------|---------|
| [runbook.md](./runbook.md) | Incident response procedures |
| [alerts.md](./alerts.md) | Alert catalog (P0/P1/P2) |
| [dashboard-guide.md](./dashboard-guide.md) | Grafana dashboard import and usage |
| [dashboards/](./dashboards/) | Grafana JSON definitions |

**Deploy artifacts:** `deploy/monitoring/prometheus.yml`, `deploy/monitoring/prometheus-alerts.yml`

**Metrics endpoint:** `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN`

**Health probes:** `/live`, `/ready`, `/health`, `/health/{db,redis,storage,cache,queue,ai}`
