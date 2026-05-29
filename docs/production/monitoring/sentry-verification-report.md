# Sentry Integration — Monitoring Verification Report

**Date:** 2026-05-30  
**Scope:** `pranidoctor-backend`, `pranidoctor-web`, `pranidoctor_user`  
**Method:** Static code review + env-template audit (no live DSN smoke test — DSNs not present in repo)  
**Reference:** [sentry-integration-plan.md](./sentry-integration-plan.md)

---

## Executive verdict

| Dimension | Result | Confidence |
|-----------|--------|------------|
| Integration completeness | **PASS** | High (code paths verified) |
| Production safety | **PASS** | High |
| Environment isolation | **PASS** (code); **ops-dependent** | Medium |
| API contract preservation | **PASS** | High |
| Sensitive data controls | **PASS** (minor gaps) | Medium |
| Crash capture paths | **PASS** (2 non-blocking gaps) | Medium |
| Release tagging | **PARTIAL** | Medium |
| Live Sentry ingest | **NOT VERIFIED** | N/A — requires staging DSN |

**Overall:** Integration is **architecturally sound and production-safe to enable via env vars**. Production readiness is **conditional** on ops configuring per-environment DSNs, `APP_VERSION`, staging smoke tests (§11 of integration plan), and symbol/source-map upload (still outstanding in CI).

**Code changes required for this verification:** None.

---

## 1. Integration inventory

### 1.1 Express API (`pranidoctor-backend`)

| Component | File | Role |
|-----------|------|------|
| Enable gate | `sentry-config.ts` → `isSentryEnabled()` | DSN required; `SENTRY_ENABLED=false` disables |
| Init | `sentry-init.ts` | `@sentry/node`; `sendDefaultPii: false`; `beforeSend` scrub |
| Bootstrap | `sentry-bootstrap.ts` | Init + `registerErrorCapture` (Sentry + webhook dual-path) |
| API 5xx | `error.handler.ts` | `captureException` for AppError ≥500 and unhandled errors only |
| Process fatal | `server.ts`, `worker.ts` | uncaught / unhandled → `captureException` before shutdown |
| Background jobs | `queue.service.ts` | Permanent job failure + worker error → Sentry tags (`queue`, `job_id`, `source`) |
| Logging preserved | `error-tracking.ts` | All captures still flow through Pino `logError` first |

### 1.2 Next.js Admin (`pranidoctor-web`)

| Component | File | Role |
|-----------|------|------|
| Server init | `instrumentation.ts` → `sentry-init.ts` | Next.js server runtime |
| Request errors | `instrumentation.ts` `onRequestError` | → `captureException` + alerts |
| Server capture | `error-tracking.ts` | Provider `sentry` when DSN set; webhook/alerts retained |
| Client init | `instrumentation-client.ts` → `sentry-client.ts` | Admin/enterprise surfaces only |
| Client capture | `error-tracking-client.ts` | `clientLog` + Sentry |
| UI boundaries | `AdminErrorBoundary`, `admin/error.tsx`, `enterprise/error.tsx` | Explicit `captureClientException` |
| CSP | `next.config.ts` | `connect-src` allows `*.ingest.sentry.io` |

### 1.3 Flutter (`pranidoctor_user`)

| Component | File | Role |
|-----------|------|------|
| SDK init | `sentry_bootstrap.dart` | DSN-gated; try/catch; no startup throw |
| Reporter | `sentry_crash_reporter.dart` | Implements `CrashReporter`; throttle; opaque user id |
| Factory | `crash_reporter_factory.dart` | Composite: Sentry + Crashlytics + webhook |
| Handlers | `global_error_handler.dart` → `AppLog.error` | Framework, zone, platform, ErrorWidget |
| User context | `session_controller.dart` | `_syncCrashUserId` → `setUserId` (opaque id) |
| Release metadata | `crash_reporting_bootstrap.dart` | PackageInfo + `SentryBootstrap.applyReleaseScope` |
| CI | `.github/workflows/release.yml` | Optional `SENTRY_DSN`, `APP_VERSION` dart-defines |

---

## 2. Production safety

| Check | Status | Evidence |
|-------|--------|----------|
| DSN absent → no-op | ✅ | `isSentryEnabled()` / `env.isSentryActive` gates all inits |
| Explicit disable | ✅ | `SENTRY_ENABLED=false` (API/web/mobile dart-define) |
| Init failure non-fatal | ✅ | try/catch in all three runtimes; warn/log only |
| Startup not blocked | ✅ | Sentry init is async but lightweight; failures don't exit process |
| Monitoring master toggle (web) | ✅ | `MONITORING_ENABLED=false` → `captureException` no-op |
| Secrets not logged | ✅ | Init logs environment/release only, never DSN |
| Server DSN not in client bundle (API) | ✅ | Backend DSN server-only |
| Dual-path rollback | ✅ | Blank DSN or `SENTRY_ENABLED=false`; webhooks unchanged |

---

## 3. Environment isolation

| Tier | Backend | Web | Mobile | Sentry `environment` field |
|------|---------|-----|--------|---------------------------|
| Local dev | No DSN default | No DSN default | `kDebugMode` → no crash export unless forced | N/A (disabled) |
| Staging | `APP_ENV=staging` in `.env.staging.example` | Set `APP_ENV=staging` on host | `APP_ENV=staging` dart-define | `staging` / `dev` / `production` name |
| Production | `APP_ENV=production` | `NODE_ENV=production` + `APP_ENV` | `APP_ENV=production` | `production` |

**Code behavior:** All runtimes prefer `APP_ENV` over `NODE_ENV` where implemented (`getSentryEnvironment()`).

**Ops requirement (not enforced in code):** Use **separate Sentry DSNs or projects** per environment. The codebase does not prevent pointing staging at a production DSN — that is a deployment guardrail.

**Mobile isolation:** `isSentryActive` requires `kReleaseMode` (unless `ENABLE_CRASH_REPORTING=true`), preventing debug builds from sending to Sentry by default.

**Web client isolation:** `isClientErrorTrackingEnabled()` defaults off outside production unless `NEXT_PUBLIC_ERROR_TRACKING_ENABLED=true`.

---

## 4. API contract preservation

Reviewed `error.handler.ts` — **no changes** to HTTP semantics:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "...",
    "requestId": "..." 
  }
}
```

| Behavior | Unchanged |
|----------|-----------|
| 4xx responses | Not sent to Sentry (warn log only) |
| 422 validation shape | Unchanged |
| 404 not found | Not captured |
| 500 internal message | Generic `InternalServerError` message to client |
| Status codes | Unchanged |

Sentry hooks run **after** response shaping; no new headers or response fields added.

---

## 5. Sensitive data / PII controls

| Control | Backend | Web | Mobile |
|---------|---------|-----|--------|
| `sendDefaultPii: false` | ✅ | ✅ | ✅ |
| Auth/cookie header scrub | ✅ `beforeSend` | ✅ | ✅ (headers only) |
| User email/username/IP scrub | ✅ | ✅ | N/A (user id only) |
| User id in Sentry | Opaque id only if passed in context | Not set on server capture | Opaque `SentryUser(id:)` |
| Log redaction (parallel path) | Pino redact paths | `serverLog` / `clientLog` | `LogRedactor` on reason/messages |
| DSN in repository | ✅ Not committed | ✅ Not committed | ✅ CI secret / dart-define only |

**Context metadata (mobile):** `CrashReportingContext.snapshot()` sends `app_env`, `api_host`, `release`, `locale` — no phone/OTP/tokens.

**Residual risks (acceptable / pre-existing):**

1. **Webhook parallel path** (`ERROR_TRACKING_WEBHOOK_URL`, `MONITORING_ALERT_WEBHOOK_URL`) may include stack traces and error messages — unchanged pre-Sentry behavior.
2. **Error messages** in Sentry events may contain user-supplied validation text on 500 paths if thrown in message — rare; no request body scrub in `beforeSend` (bodies not attached by default in manual capture).
3. **AdminErrorBoundary** sends React `componentStack` as a tag — component names only, not credentials.
4. **`NEXT_PUBLIC_SENTRY_DSN`** is intentionally public (standard for browser SDKs).

**No P0 leakage found.** No code fix required.

---

## 6. Crash capture path matrix

| Event source | Backend Sentry | Web server Sentry | Web client Sentry | Mobile Sentry |
|--------------|----------------|-------------------|-------------------|---------------|
| HTTP 5xx | ✅ `errorHandler` | ✅ via BFF/proxy errors if surfaced | — | — |
| HTTP 4xx | ❌ (by design) | ❌ | ❌ | — |
| Unhandled route error | ✅ | ✅ `onRequestError` | — | — |
| `uncaughtException` / `unhandledRejection` | ✅ | Edge skipped | — | ✅ via `GlobalErrorHandler` |
| BullMQ permanent failure | ✅ | — | — | — |
| Worker process error | ✅ | — | — | — |
| Flutter framework fatal | — | — | — | ✅ `AppLog` → reporter |
| Zone / platform async | — | — | — | ✅ |
| ErrorWidget (non-fatal) | — | — | — | ✅ fatal=false |
| `window.error` / unhandledrejection | — | — | ✅ admin/enterprise only | — |
| React error boundary | — | — | ✅ | — |
| Next.js route error.tsx | — | — | ✅ | — |
| Provider observer failures | — | — | — | ✅ (via crash reporting observer) |

### Non-blocking gaps

| ID | Gap | Severity | Notes |
|----|-----|----------|-------|
| G1 | Web client Sentry init is async; first error before init completes hits `clientLog` only | P2 | Subsequent errors captured; init runs on admin surface load |
| G2 | Flutter may double-report if Sentry SDK native hooks and `SentryCrashReporter` both capture same error | P2 | Monitor issue volume after enable; dedupe in Sentry if needed |
| G3 | Process fatal shutdown does not call `Sentry.flush()` / `close()` | P2 | Event may be lost on immediate exit; low frequency |
| G4 | Edge runtime requests skip Sentry (`isEdgeRuntime()` guard) | P3 | Acceptable if admin routes are Node runtime |

---

## 7. Release / version tagging

| Runtime | Sentry `release` at init | Post-deploy tag | CI symbol upload |
|---------|-------------------------|-------------------|------------------|
| Backend | `{APP_NAME}@{APP_VERSION}` | — | N/A |
| Web | `pranidoctor-web-admin@{APP_VERSION}` | — | ❌ Not in CI |
| Mobile | `pranidoctor-mobile@{APP_VERSION}` if dart-define set | `release` tag after `PackageInfo` | ❌ debug-info artifact only; no `sentry-cli upload-dif` |

**Findings:**

- ✅ Release format is consistent and documented.
- ⚠️ If `APP_VERSION` unset at deploy, Sentry `release` field is undefined (issues still grouped by environment).
- ⚠️ Mobile events before `applyReleaseInfo()` may lack full release string in Sentry release field (tag added later).
- ❌ Symbol/source-map upload not wired — stack traces may be obfuscated/minified in prod mobile/web until CI step added.

---

## 8. Enable / disable matrix (verified)

| Action | Effect |
|--------|--------|
| Unset `SENTRY_DSN` | All runtimes: no Sentry init |
| `SENTRY_ENABLED=false` | Disables Sentry even with DSN |
| `ERROR_TRACKING_PROVIDER=noop` (web) | Overrides auto-sentry selection |
| `MONITORING_ENABLED=false` (web) | Disables all server error tracking |
| `NEXT_PUBLIC_ERROR_TRACKING_ENABLED=false` | Disables client Sentry eligibility |
| Mobile debug build without `ENABLE_CRASH_REPORTING` | No outbound crash reporting |
| Revoke DSN in Sentry UI | Stray clients cannot ingest |

---

## 9. Live verification checklist (ops — pending)

These were **not executed** in this audit (no DSN configured):

| # | Test | Expected |
|---|------|----------|
| V1 | Backend staging: throw 500 on test route | Issue in `pranidoctor-api`, tag `request_id` |
| V2 | Web: failing admin server route | `onRequestError` issue with `route` |
| V3 | Web: force React error in admin | Client issue, tag `kind=error_boundary` |
| V4 | Mobile staging build + DSN: throw | Issue, `environment=staging`, user id if logged in |
| V5 | Unset DSN, repeat V1 | No Sentry event; Pino log only |
| V6 | Health/uptime JSON `version` matches Sentry release | Cross-check `APP_VERSION` |

**Recommendation:** Run V1–V6 on staging before production DSN enable (see integration plan §11).

---

## 10. Risk register (post-review)

| ID | Risk | Level | Mitigation |
|----|------|-------|------------|
| R1 | Staging DSN misconfigured to prod project | Medium | Separate projects; code review deploy env |
| R2 | Web client first-error miss (G1) | Low | Accept or await init in follow-up |
| R3 | Flutter duplicate events (G2) | Low | Monitor after enable |
| R4 | No symbol upload | Medium | Add CI `sentry-cli` when DSN live |
| R5 | Fatal exit before flush (G3) | Low | Optional `Sentry.close()` on shutdown |

---

## 11. Sign-off

| Reviewer role | Result |
|---------------|--------|
| Architecture / integration | ✅ Approved |
| Security / PII | ✅ Approved with noted webhook parity |
| API compatibility | ✅ Approved |
| Production enable | ⏳ Pending live staging smoke (§9) |

**Next ops steps (no code required):**

1. Create staging Sentry projects + DSNs for API, admin web, mobile.
2. Set `APP_ENV`, `APP_VERSION`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` on staging hosts.
3. Execute verification checklist §9.
4. Add `sentry-cli` symbol/source-map upload to release CI (P2 enhancement).
5. Enable production DSNs after 7-day staging burn-in or successful smoke.

---

## Document maintenance

Update this report after first successful staging smoke test with dates, Sentry issue URLs (internal), and any volume/duplicate observations.
