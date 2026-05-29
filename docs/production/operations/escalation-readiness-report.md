# Escalation Monitoring — Readiness Report

**Date:** 2026-05-30  
**Scope:** `pranidoctor-backend` Phase 1 business-ops escalation monitoring  
**Method:** Static code audit, alert/threshold mapping vs plan, unit-test execution  
**Reference:** [escalation-monitoring-plan.md](./escalation-monitoring-plan.md), [backend-monitoring-verification-report.md](../monitoring/backend-monitoring-verification-report.md)

**Code changes required for this verification:** None.

---

## Executive verdict

| Dimension | Result | Confidence | Production-ready? |
|-----------|--------|------------|-------------------|
| Escalation detection | **PASS** | High | Yes — with webhook + ops routing |
| SLA monitoring | **PASS** (partial bands) | High | Yes — tune thresholds post-baseline |
| Threshold accuracy | **PASS** (minor doc/code drift) | Medium | Yes — env overrides documented |
| Incident visibility | **PARTIAL** | Medium | Alerts + gauges yes; Grafana/admin queue no |

**Overall readiness:** **Conditionally ready** — escalation monitoring is correctly implemented as **read-only DB polling + OPS-* webhooks + Prometheus gauges**. Production value depends on **`MONITORING_ALERT_WEBHOOK_URL`**, ops runbook adoption, and tuning SLA env vars after the first operational week.

### Readiness scorecard

| Layer | Score | Notes |
|-------|-------|-------|
| Detection coverage | **8/10** | 14 OPS alert paths; a few workflow blind spots |
| Threshold configurability | **9/10** | 17 env vars; defaults match plan |
| Workflow safety | **10/10** | No mutations to ServiceRequest/support flows |
| Alert delivery | **7/10** | Reuses dedup/storm caps; multi-instance duplicate risk |
| Visibility (dashboards) | **5/10** | Prometheus series exist; no Grafana clinical board |
| Test coverage | **6/10** | Config + mocked cycle; no DB integration tests |

---

## 1. Validation — escalation detection

### 1.1 Alert inventory vs implementation

| Alert ID | Implemented | Trigger in code | Severity | Fingerprint |
|----------|-------------|-----------------|----------|-------------|
| OPS-REQ-01 | ✅ | Pending count + oldest age | info | `pending-backlog` |
| OPS-REQ-02 | ✅ | `ASSIGNED` stale by priority band | critical/warning | `sr-accept:{band}` |
| OPS-REQ-03 | ✅ | Emergency `PENDING` past threshold | critical | `emergency-unassigned` |
| OPS-REQ-04 | ✅ | Rejection rate in window | warning | `rejection-spike` |
| OPS-CON-01 | ✅ | Emergency `REJECTED` in window | warning | `emergency-rejected:*` |
| OPS-CON-02 | ✅ | Cancel-after-accept count | warning | `consult-failure-spike` |
| OPS-CON-03 | ✅ | `IN_PROGRESS` stalled | warning/info | `stalled-{band}` |
| OPS-CON-04 | ✅ | Online consult past `scheduledStart` | warning | `online-missed-window` |
| OPS-SUP-01 | ✅ | OPEN tickets, no SUPPORT reply | info | `support-unanswered` |
| OPS-SUP-02 | ✅ | URGENT OPEN tickets aging | warning | `support-urgent` |
| OPS-SUP-03 | ✅ | Technician complaints OPEN | info | `technician-complaints` |
| OPS-ESC-01 | ✅ | AI escalation backlog | warning | `ai-escalation-backlog` |
| OPS-ESC-02 | ✅ | `EMERGENCY_SYMPTOM` unreviewed | critical | `ai-emergency-symptom` |
| OPS-BIL-01 | ✅ | Emergency billing `FAILED` | info | `billing-failed-emergency` |

**Source:** `escalation-monitor.service.ts` → `escalation-alerts.ts` → `alert-service.ts`

### 1.2 Escalation signal mapping

| Escalation type | Detection mechanism | Matches workflow? |
|-----------------|---------------------|-------------------|
| Unanswered ops cases | `PENDING` doctor consult types | ✅ |
| Doctor delay | `ASSIGNED` + `assignedAt` age | ✅ (proxy for accept delay) |
| Emergency triage | `isEmergency` / `priority=EMERGENCY` / `EMERGENCY_DOCTOR` | ✅ |
| Failed consult | `REJECTED`, cancel-after-accept, stalled `IN_PROGRESS` | ✅ |
| AI safety handoff | `AiEscalationRecord` status + reason | ✅ |
| Support incidents | `SupportTicket` OPEN + message author | ✅ |
| Technician quality | `AiTechnicianComplaint.OPEN` | ✅ |

### 1.3 Detection gaps

| ID | Gap | Impact | Mitigation |
|----|-----|--------|------------|
| D-01 | **`ACCEPTED` without `IN_PROGRESS`** not monitored | Doctor accepted but never started treatment | Phase 2: stale `ACCEPTED` check |
| D-02 | **Online consult** uses `scheduledStart` only | Most bookings set `preferredTime` text, not `scheduledStart` | OPS-CON-04 under-detects; use admin panel for text-only bookings |
| D-03 | **HIGH priority stalled in-progress** rolled into “normal” band | HIGH emergencies mis-bucketed only for accept SLA, not stall | Acceptable; tune env if needed |
| D-04 | **Cancel-after-accept** capped at 200 rows/window | Undercount during mass cancel events | Raise cap or use aggregate SQL |
| D-05 | **Billing FAILED** is all-time, not windowed | Repeat alert every dedup window until fixed | Dedup fingerprint limits noise |
| D-06 | **Worker process** does not run escalation monitor | Queue-only failures not in ops SLA scope | By design — API server only |

---

## 2. Validation — SLA monitoring

### 2.1 Scheduler and lifecycle

| Check | Status | Evidence |
|-------|--------|----------|
| Starts on API boot | ✅ | `server.ts` → `startEscalationMonitoring()` after listen |
| Stops on shutdown | ✅ | `stopEscalationMonitoring()` in shutdown handler |
| Default interval 5 min | ✅ | `ESCALATION_CHECK_INTERVAL_MS` default `300000` |
| Overlap guard | ✅ | `running` flag skips concurrent cycles |
| Read-only queries | ✅ | Repository uses `count`/`findMany` only |
| Structured completion log | ✅ | `event: ops.escalation.check` |
| Error isolation | ✅ | Cycle catch logs `ops.escalation.error`; no process exit |

### 2.2 SLA rules implemented

| SLA (plan) | Implementation | Time basis |
|------------|----------------|------------|
| Emergency unassigned 15m | `OPS-REQ-03` | `submittedAt` |
| Doctor accept 15m / 60m / 240m | `OPS-REQ-02` bands | `assignedAt` while `ASSIGNED` |
| Pending backlog 10 @ 2h | `OPS-REQ-01` | count + oldest `submittedAt` |
| In-progress stall 4h / 24h | `OPS-CON-03` | `startedAt` |
| Support unanswered 4h | `OPS-SUP-01` | `createdAt`, no SUPPORT messages |
| URGENT support 1h | `OPS-SUP-02` | `createdAt` |
| AI emergency symptom 30m | `OPS-ESC-02` | `flaggedAt` |
| AI backlog >10 | `OPS-ESC-01` | count `PENDING_REVIEW` + `QUEUED` |

**Note:** Doctor accept SLA uses **`assignedAt` in `ASSIGNED` status**, not timeline `ACCEPTED` timestamp. This matches operational intent (doctor has not accepted while status remains assigned) and avoids schema changes.

### 2.3 Consult type scope

Doctor SLA queries filter to:

- `DOCTOR_HOME_VISIT`
- `EMERGENCY_DOCTOR`
- `ONLINE_CONSULTATION_LATER`

**Excludes** `AI_SERVICE` technician bookings — correct separation of workflows.

---

## 3. Validation — threshold accuracy

### 3.1 Default env vs plan

| Env variable | Code default | Plan default | Match |
|--------------|--------------|--------------|-------|
| `OPS_EMERGENCY_UNASSIGNED_MINUTES` | 15 | 15 | ✅ |
| `OPS_DOCTOR_ACCEPT_EMERGENCY_MINUTES` | 15 | 15 | ✅ |
| `OPS_DOCTOR_ACCEPT_HIGH_MINUTES` | 60 | 60 | ✅ |
| `OPS_DOCTOR_ACCEPT_NORMAL_MINUTES` | 240 | 240 (4h) | ✅ |
| `OPS_PENDING_BACKLOG_THRESHOLD` | 10 | 10 | ✅ |
| `OPS_PENDING_BACKLOG_MINUTES` | 120 | 120 (2h) | ✅ |
| `OPS_IN_PROGRESS_STALLED_EMERGENCY_MINUTES` | 240 | 240 (4h) | ✅ |
| `OPS_IN_PROGRESS_STALLED_NORMAL_MINUTES` | 1440 | 1440 (24h) | ✅ |
| `OPS_SUPPORT_UNANSWERED_MINUTES` | 240 | 240 (4h) | ✅ |
| `OPS_SUPPORT_URGENT_MINUTES` | 60 | 60 (1h) | ✅ |
| `OPS_TECHNICIAN_COMPLAINT_OPEN_MINUTES` | 1440 | 1440 (24h) | ✅ |
| `OPS_AI_ESCALATION_BACKLOG_THRESHOLD` | 10 | 10 | ✅ |
| `OPS_AI_EMERGENCY_SYMPTOM_MINUTES` | 30 | 30 | ✅ |
| `OPS_REJECTION_SPIKE_WINDOW_HOURS` | 4 | 4 | ✅ |
| `OPS_REJECTION_SPIKE_RATE` | 0.2 | 0.2 (20%) | ✅ |
| `OPS_CONSULT_FAILURE_SPIKE_THRESHOLD` | 5 | 5 | ✅ |
| `ESCALATION_CHECK_INTERVAL_MS` | 300000 | 5 min (implied) | ✅ |

### 3.2 Configurable override behavior

| Check | Status | Evidence |
|-------|--------|----------|
| Master toggle | ✅ | `ESCALATION_MONITORING_ENABLED` / `MONITORING_ENABLED` |
| Invalid ints fall back | ✅ | `parsePositiveInt` |
| Invalid rate falls back | ✅ | `parseRate` clamps (0, 1] |
| Unit tests for overrides | ✅ | `escalation-config.test.ts` (3 tests) |

### 3.3 Threshold drift / accuracy notes

| Item | Plan wording | Actual behavior | Severity |
|------|--------------|-----------------|----------|
| OPS-CON-02 window | “>5 / **1h**” in alert table | Uses **`OPS_REJECTION_SPIKE_WINDOW_HOURS`** (4h) for cancel-after-accept count | Doc drift — functionally stricter aggregate |
| OPS-REQ-01 business hours | “business hours only” in fatigue table | **Not enforced in code** — fires 24/7 | Ops may want env schedule or external silencing |
| Emergency filter OR | Three signals OR’d | Correct — avoids missing mis-tagged emergencies | ✅ |
| Rejection rate denominator | Assignments in window | `assignedAt >= since` — reasonable proxy | ✅ |

---

## 4. Validation — incident visibility

### 4.1 Alert payload quality

| Field | Status | Notes |
|-------|--------|-------|
| Stable `alertId` (`OPS-*`) | ✅ | Matches plan catalog |
| Severity tier | ✅ | critical / warning / info |
| Sample service request IDs | ✅ | Up to 5 in metadata |
| Minutes waiting | ✅ | Computed in alert metadata |
| Dedup fingerprint | ✅ | Per alert type / band |
| Runbook link in webhook | ⚠️ | `ESCALATION_RUNBOOK` defined but **not passed** to `sendProductionAlert` — uses default `incident-response-guide.md` |

### 4.2 Prometheus visibility

| Metric | Exported | Updated when |
|--------|----------|--------------|
| `pranidoctor_ops_pending_consultations` | ✅ | Each cycle |
| `pranidoctor_ops_assigned_stale_total{priority}` | ✅ | Each cycle |
| `pranidoctor_ops_in_progress_stalled_total{priority}` | ✅ | Each cycle |
| `pranidoctor_ops_support_unanswered_total` | ✅ | Each cycle |
| `pranidoctor_ops_ai_escalation_backlog_total` | ✅ | Each cycle |
| `pranidoctor_ops_online_consult_missed_window_total` | ✅ | Each cycle |

**Gap:** No Prometheus alert rules file for `OPS-*` series (unlike `ALT-*` in `prometheus-alerts.yml`). Ops rely on webhooks or manual Grafana setup.

### 4.3 Human visibility channels

| Channel | Status |
|---------|--------|
| Slack/PagerDuty webhook | ✅ when `MONITORING_ALERT_WEBHOOK_URL` set |
| Admin `/admin/service-requests` | ✅ manual correlation |
| Admin `/admin/ai-ops/governance` | ✅ AI escalations |
| Admin support ticket desk | ❌ not built — alerts only |
| Grafana clinical dashboard | ❌ not deployed |
| Log query `ops.escalation.check` | ✅ JSON log line each cycle |

### 4.4 Multi-instance behavior

| Risk | Detail |
|------|--------|
| Duplicate webhooks | Each API replica runs its own interval + in-memory dedup |
| Gauge values | Per-process; Prometheus should scrape one target or sum carefully |

**Recommendation:** Run escalation polling on **one designated API instance** or accept 15m dedup window across replicas.

---

## 5. Test evidence

| Artifact | Result |
|----------|--------|
| `escalation-config.test.ts` | ✅ 3/3 passed |
| `escalation-monitor.service.test.ts` | ✅ 2/2 passed (mocked repository) |
| Live DB SLA cycle | ⚠️ Not run (requires running API + seed data) |
| Live webhook delivery | ⚠️ Not run (no webhook URL in CI) |

---

## 6. Gaps summary

### P0 — before relying on ops alerts in production

| ID | Gap | Action |
|----|-----|--------|
| G-P0-01 | Webhook not configured | Set `MONITORING_ALERT_WEBHOOK_URL` + route `#pranidoctor-ops-clinical` |
| G-P0-02 | No staging smoke test | Inject stale `ASSIGNED` row → verify OPS-REQ-02 webhook |
| G-P0-03 | Multi-instance duplicate alerts | Single scraper instance or leader election (Phase 2) |

### P1 — quality improvements

| ID | Gap | Action |
|----|-----|--------|
| G-P1-01 | Runbook not in alert payload | Pass `ESCALATION_RUNBOOK` in `sendProductionAlert` |
| G-P1-02 | OPS-CON-04 misses `preferredTime`-only bookings | Parse or admin-set `scheduledStart` |
| G-P1-03 | Stale `ACCEPTED` not monitored | Add OPS-CON-05 in Phase 2 |
| G-P1-04 | No Prometheus rules for ops gauges | Add `prometheus-alerts-ops.yml` |
| G-P1-05 | No DB integration test | Supertest + test DB fixture |

### P2 — enhancements

| ID | Gap |
|----|-----|
| G-P2-01 | Business-hours-only alerting for non-emergency SLAs |
| G-P2-02 | Grafana dashboard for ops KPIs |
| G-P2-03 | Admin support ticket queue linked to OPS-SUP alerts |

---

## 7. Recommendations

### Immediate (go-live)

1. Configure **`MONITORING_ALERT_WEBHOOK_URL`** and verify a test OPS alert renders in Slack.
2. Document **on-call routing**: OPS-REQ-03 / OPS-ESC-02 → SEV-1 phone; OPS-REQ-02 emergency → clinical ops.
3. Run **staging smoke** (§8) before production enablement.
4. Set **`ESCALATION_MONITORING_ENABLED=true`** explicitly in production env templates.

### First week of production

5. Review `ops.escalation.check` logs and webhook volume; tune thresholds if alert fatigue occurs.
6. Compare Prometheus ops gauges with admin panel counts daily.
7. Fix doc drift: OPS-CON-02 window description vs `OPS_REJECTION_SPIKE_WINDOW_HOURS`.

### Phase 2

8. Add stale **`ACCEPTED`** SLA check and `scheduledStart` backfill for online consults.
9. Deploy Grafana board + Prometheus alert rules for ops series.
10. Pass escalation runbook URL in webhook payload.

---

## 8. Staging smoke checklist

- [ ] Create `PENDING` + `isEmergency` request older than `OPS_EMERGENCY_UNASSIGNED_MINUTES` → expect **OPS-REQ-03**
- [ ] Assign doctor, leave `ASSIGNED` past emergency accept threshold → expect **OPS-REQ-02** (critical)
- [ ] Create `AiEscalationRecord` `EMERGENCY_SYMPTOM` + `PENDING_REVIEW` aged → expect **OPS-ESC-02**
- [ ] Open `SupportTicket` URGENT without SUPPORT message → expect **OPS-SUP-02**
- [ ] Scrape `/metrics` → verify `pranidoctor_ops_*` series present after one cycle
- [ ] Confirm **no** ServiceRequest status changes from monitor (read-only)

---

## 9. Sign-off

| Role | Criteria |
|------|----------|
| Engineering | All 14 OPS paths coded; tests green; no workflow mutations |
| Ops | Webhook routed; escalation matrix (plan §7) adopted |
| Clinical lead | SLA minutes reviewed for Bangladesh operations |
| Launch lead | Staging smoke §8 complete |

---

## 10. Related documents

| Document | Purpose |
|----------|---------|
| [escalation-monitoring-plan.md](./escalation-monitoring-plan.md) | Architecture, alert catalog, escalation matrix |
| [backend-monitoring-verification-report.md](../monitoring/backend-monitoring-verification-report.md) | Infra metrics/logs audit |
| [alerting-plan.md](../../../pranidoctor_user/docs/production/monitoring/alerting-plan.md) | Platform alerting tiers |

---

**Report status:** Complete — escalation monitoring **conditionally production-ready** pending webhook configuration and staging smoke tests.
