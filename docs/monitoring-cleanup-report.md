# Monitoring Cleanup Report

**Date:** 2026-06-03  
**Service:** Prani Doctor API (`pranidoctor-backend`)  
**Scope:** Escalation monitoring startup alerts, seeded data exclusion, environment-aware delivery.

---

## Executive summary

On API startup, `startEscalationMonitoring()` runs an immediate cycle against the database. In **development** with **USER_APP seed data** (`uaseed-v1-appt-*`), that produced a burst of `monitoring.alert` logs (OPS-REQ-*, OPS-CON-03, etc.) for consultations that are intentionally old and non-production.

This audit adds **monitoring scope filters**, **environment-aware alert suppression**, and documents every alert type fired at boot.

---

## 1. Startup alert inventory

Triggered from `src/server.ts` → `startEscalationMonitoring()` → `runEscalationMonitoringCycle()` (first run is immediate, then every `ESCALATION_CHECK_INTERVAL_MS`, default 5 min).

| Alert ID | Severity | Typical startup cause (dev + seed) |
|----------|----------|-------------------------------------|
| **OPS-REQ-01** | info | Many `PENDING` doctor consults from seed (e.g. 92 pending) |
| **OPS-REQ-02** | critical/warning | `ASSIGNED` seed rows past accept SLA (emergency/high/normal bands) |
| **OPS-REQ-03** | critical | Emergency consults unassigned >15 min (seed `PENDING` + old `submittedAt`) |
| **OPS-REQ-04** | warning | Rejection rate spike in 4h window (seed mix of statuses) |
| **OPS-CON-01** | warning | Recent emergency `REJECTED` rows |
| **OPS-CON-02** | warning | Cancel-after-accept count ≥ threshold |
| **OPS-CON-03** | info/warning | **`IN_PROGRESS` stalled** — main noise; seed sets `startedAt` up to 25+ days ago |
| **OPS-CON-04** | warning | Online consult past `scheduledStart` (if seed includes them) |
| **OPS-SUP-01** | info | Open support tickets without staff reply |
| **OPS-SUP-02** | warning | URGENT tickets aging |
| **OPS-SUP-03** | info | AI technician complaints open |
| **OPS-ESC-01** | warning | AI escalation backlog |
| **OPS-ESC-02** | critical | Unreviewed EMERGENCY_SYMPTOM escalations |
| **OPS-BIL-01** | info | Failed emergency billing |

Log shape:

```json
{
  "event": "monitoring.alert",
  "alertId": "OPS-CON-03",
  "severity": "info",
  "metadata": {
    "samples": [{ "id": "uaseed-v1-appt-0057", "minutesWaiting": 71119 }]
  }
}
```

Completion log (always):

```json
{
  "event": "ops.escalation.check",
  "pendingCount": 92,
  "monitoringScope": { "demoIdExclusion": true, "maxRecordAgeDays": 14 }
}
```

---

## 2. Root cause: seeded / demo data

| Source | Pattern | Effect on monitoring |
|--------|---------|----------------------|
| `scripts/seed/user_app_seed.ts` | IDs `uaseed-v1-appt-####` | All service-request queries matched |
| Seed emails | `*@userapp.seed.pranidoctor.test` | Customer-linked tickets/requests |
| Seed timestamps | `daysAgo(rng, 120)` created, `daysAgo(rng, 25)` started | Triggers OPS-CON-03 (>1440 min normal band) |
| Status rotation | PENDING, ASSIGNED, IN_PROGRESS, … | Backlog + SLA + stall alerts |

**Example:** 10 consultations `IN_PROGRESS` >1440 min with IDs `uaseed-v1-appt-*` → OPS-CON-03 at severity `info` on every cycle until dedup window expires.

---

## 3. Fixes implemented

### 3.1 Demo / seed detection

**File:** `src/shared/monitoring/demo-data.constants.ts`  
**File:** `src/shared/monitoring/escalation/monitoring-scope.ts`

- Exclude IDs with prefixes: `uaseed-`, `demo-`, `test-seed-` (override via `MONITORING_EXCLUDE_ID_PREFIXES`)
- Exclude service requests / support tickets for customers whose user email ends with `@userapp.seed.pranidoctor.test` (`MONITORING_EXCLUDE_SEED_CUSTOMERS`, default on)

### 3.2 Historical record cutoff

Env: **`OPS_MONITORING_MAX_RECORD_AGE_DAYS`**

| Environment | Default | Behavior |
|-------------|---------|----------|
| Production | 45 days | Ignore records older than 45 days for stall/assign/window queries |
| Non-production | 14 days | Tighter window for dev DBs with old seed |

Applied to `startedAt`, `assignedAt`, `submittedAt`, `updatedAt`, `cancelledAt`, and spike windows.

### 3.3 Environment-aware monitoring

| Mode | Cycle runs | Alerts delivered |
|------|------------|------------------|
| **Development** | Yes (metrics + `ops.escalation.check`) | **Suppressed** unless `MONITORING_ALERTS_IN_DEV=true` |
| **Production** | Yes | **Delivered** (webhook or `monitoring.alert` log) |
| **Test** | Configurable | Suppressed |

**File:** `escalation-config.ts` → `shouldDeliverMonitoringAlerts()`  
**File:** `alert-service.ts` → early return with `Alert suppressed (non-production monitoring)`

### 3.4 Repository scope

**File:** `escalation.repository.ts` — all counts/findMany use `serviceRequestMonitoringScope()`, `supportTicketMonitoringScope()`, or `aiEscalationMonitoringScope()`.

### 3.5 Alert payload hygiene

**File:** `escalation-alerts.ts` — `filterDemoSampleRows()` on row-based alerts so metadata never lists `uaseed-*` IDs even if a query regresses.

---

## 4. Configuration reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `ESCALATION_MONITORING_ENABLED` | on (via `MONITORING_ENABLED`) | Master ops monitor toggle |
| `MONITORING_ENABLED` | true | Global alerting |
| `MONITORING_ALERTS_IN_DEV` | false | Allow webhook/log alerts in development |
| `MONITORING_EXCLUDE_DEMO_IDS` | true | Prefix exclusion |
| `MONITORING_EXCLUDE_ID_PREFIXES` | `uaseed-,demo-,test-seed-` | Comma-separated |
| `MONITORING_EXCLUDE_SEED_CUSTOMERS` | true | Seed email domain exclusion |
| `OPS_MONITORING_MAX_RECORD_AGE_DAYS` | 14 dev / 45 prod | Ignore ancient rows |
| `OPS_IN_PROGRESS_STALLED_NORMAL_MINUTES` | 1440 | OPS-CON-03 normal band |
| `OPS_IN_PROGRESS_STALLED_EMERGENCY_MINUTES` | 240 | OPS-CON-03 emergency band |
| `ESCALATION_CHECK_INTERVAL_MS` | 300000 | Scheduler interval |

---

## 5. Development vs production

### Development (recommended)

```env
NODE_ENV=development
# Alerts suppressed by default; cycles still run for metrics/logs
# MONITORING_ALERTS_IN_DEV=false

# Optional: disable ops monitor entirely
# ESCALATION_MONITORING_ENABLED=false
```

After seed cleanup filters: expect **near-zero** breach counts and **no** `monitoring.alert` spam on startup.

### Production

```env
NODE_ENV=production
MONITORING_ALERTS_IN_DEV=false
MONITORING_EXCLUDE_DEMO_IDS=true
OPS_MONITORING_MAX_RECORD_AGE_DAYS=45
MONITORING_ALERT_WEBHOOK_URL=https://...
```

Only **real** service requests (non-`uaseed-*`, non-seed customers, within age window) drive alerts.

---

## 6. Verification

```bash
# Unit tests
npm test -- monitoring-scope escalation-config escalation-monitor

# Start API — should see ops.escalation.check without monitoring.alert flood in dev
npm run dev

# Force dev alerts (debug only)
MONITORING_ALERTS_IN_DEV=true npm run dev
```

Check logs for:

- `Alert suppressed (non-production monitoring)` — expected in dev
- `monitoringScope.demoIdExclusion: true` on `ops.escalation.check`
- No samples with `uaseed-` in metadata when filters active

---

## 7. Code map

| File | Role |
|------|------|
| `src/shared/monitoring/demo-data.constants.ts` | Seed ID/email constants |
| `src/shared/monitoring/escalation/monitoring-scope.ts` | Prisma scope builders |
| `src/shared/monitoring/escalation/escalation-config.ts` | Thresholds + env gates |
| `src/shared/monitoring/escalation/escalation.repository.ts` | Scoped DB queries |
| `src/shared/monitoring/escalation/escalation-alerts.ts` | OPS-* alert emitters |
| `src/shared/monitoring/escalation/escalation-monitor.service.ts` | Scheduler + cycle |
| `src/shared/monitoring/alerting/alert-service.ts` | Delivery + dev suppression |
| `src/server.ts` | `startEscalationMonitoring()` on listen |
| `scripts/seed/user_app_seed.ts` | Source of `uaseed-v1-appt-*` data |

---

## 8. Operational notes

1. **Re-seed or stale DB:** If non-prefixed test rows remain, tune `OPS_MONITORING_MAX_RECORD_AGE_DAYS` or clear old `IN_PROGRESS` seed rows.
2. **Alert fatigue in prod:** Increase thresholds via existing `OPS_*` env vars (see `docs/production/operations/escalation-monitoring-plan.md`).
3. **Dedup:** `ALERT_DEDUP_WINDOW_MS` (default 15 min) still applies; suppression in dev avoids noise entirely.
4. **Startup never blocked:** Cycle errors log `ops.escalation.error` only; server boot is unaffected.

---

*Generated from escalation monitoring audit — Prani Doctor backend.*
